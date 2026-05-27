import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateStreamCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';

const bedrock = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;
  const callbackUrl = `https://${domainName}/${stage}`;
  const apigw = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  const send = (data) =>
    apigw.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    await send({ type: 'error', message: 'Invalid JSON' });
    return { statusCode: 400 };
  }

  const question = body?.message?.trim();
  if (!question) {
    await send({ type: 'error', message: 'Empty message' });
    return { statusCode: 400 };
  }

  try {
    const command = new RetrieveAndGenerateStreamCommand({
      input: { text: question },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
          modelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
        },
      },
    });

    const response = await bedrock.send(command);

    // Stream tokens to the client
    for await (const chunk of response.stream) {
      if (chunk.output?.text) {
        await send({ type: 'token', text: chunk.output.text });
      }
    }

    // Send citations from the final response metadata
    const citations =
      response.citations?.flatMap((c) =>
        c.retrievedReferences?.map((r) => r.location?.s3Location?.uri ?? r.location?.type) ?? []
      ) ?? [];

    await send({ type: 'done', citations: [...new Set(citations)] });
  } catch (err) {
    console.error(err);
    await send({ type: 'error', message: err.message });
  }

  return { statusCode: 200 };
};
