# Quick Start: All-at-Once Deployment

Single EC2 instance deployment with brief downtime.

## Prerequisites
- EC2 instance with tag `Name=image-uploader`
- EFS file system created
- GitHub repository

## Step 1: Prepare EC2 Instance

```bash
# SSH to EC2 instance
ssh ec2-user@<instance-ip>

# Install CodeDeploy agent
sudo dnf install -y ruby wget
cd /tmp
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo systemctl start codedeploy-agent
sudo systemctl enable codedeploy-agent

# Verify agent is running
sudo systemctl status codedeploy-agent

# Store EFS ID in SSM Parameter Store (optional)
aws ssm put-parameter \
  --name /app/efs-id \
  --value "fs-xxxxxxxxx" \
  --type String
```

## Step 2: Create IAM Roles

**EC2 Instance Role** - Attach to your EC2:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "elasticfilesystem:*",
        "ssm:GetParameter"
      ],
      "Resource": "*"
    }
  ]
}
```

**CodeDeploy Service Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "autoscaling:*",
        "elasticloadbalancing:*"
      ],
      "Resource": "*"
    }
  ]
}
```

Trust policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "codedeploy.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Step 3: Create CodeDeploy Application

```bash
# Create application
aws deploy create-application \
  --application-name image-uploader \
  --compute-platform Server \
  --region us-east-1

# Create deployment group
aws deploy create-deployment-group \
  --application-name image-uploader \
  --deployment-group-name production \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --ec2-tag-filters Key=Name,Value=image-uploader,Type=KEY_AND_VALUE \
  --service-role-arn arn:aws:iam::ACCOUNT_ID:role/CodeDeployServiceRole \
  --region us-east-1
```

## Step 4: Create S3 Bucket for Artifacts

```bash
aws s3 mb s3://image-uploader-artifacts-ACCOUNT_ID --region us-east-1
```

## Step 5: Create CodeBuild Project

**CodeBuild Service Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "*"
    }
  ]
}
```

```bash
aws codebuild create-project \
  --name image-uploader-build \
  --source type=CODEPIPELINE \
  --artifacts type=CODEPIPELINE \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL \
  --service-role arn:aws:iam::ACCOUNT_ID:role/CodeBuildServiceRole \
  --region us-east-1
```

**What CodeBuild Does:**
1. Installs Node.js dependencies
2. Runs automated tests (validates h1 tag contains "AWS Storage")
3. Creates deployment artifact
4. Build fails if tests fail, preventing broken code deployment

## Step 6: Store GitHub Token in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name github-token \
  --secret-string "ghp_your_github_personal_access_token" \
  --region us-east-1
```

## Step 7: Create CodePipeline

**CodePipeline Service Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "codebuild:*",
        "codedeploy:*",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

Create `pipeline-config.json`:
```json
{
  "pipeline": {
    "name": "image-uploader-pipeline",
    "roleArn": "arn:aws:iam::ACCOUNT_ID:role/CodePipelineServiceRole",
    "artifactStore": {
      "type": "S3",
      "location": "image-uploader-artifacts-ACCOUNT_ID"
    },
    "stages": [
      {
        "name": "Source",
        "actions": [
          {
            "name": "SourceAction",
            "actionTypeId": {
              "category": "Source",
              "owner": "ThirdParty",
              "provider": "GitHub",
              "version": "1"
            },
            "configuration": {
              "Owner": "vietaws",
              "Repo": "architecting",
              "Branch": "lab15-cicd",
              "OAuthToken": "{{resolve:secretsmanager:github-token}}"
            },
            "outputArtifacts": [
              {
                "name": "SourceOutput"
              }
            ]
          }
        ]
      },
      {
        "name": "Build",
        "actions": [
          {
            "name": "BuildAction",
            "actionTypeId": {
              "category": "Build",
              "owner": "AWS",
              "provider": "CodeBuild",
              "version": "1"
            },
            "configuration": {
              "ProjectName": "image-uploader-build"
            },
            "inputArtifacts": [
              {
                "name": "SourceOutput"
              }
            ],
            "outputArtifacts": [
              {
                "name": "BuildOutput"
              }
            ]
          }
        ]
      },
      {
        "name": "Deploy",
        "actions": [
          {
            "name": "DeployAction",
            "actionTypeId": {
              "category": "Deploy",
              "owner": "AWS",
              "provider": "CodeDeploy",
              "version": "1"
            },
            "configuration": {
              "ApplicationName": "image-uploader",
              "DeploymentGroupName": "production"
            },
            "inputArtifacts": [
              {
                "name": "BuildOutput"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Create pipeline:
```bash
aws codepipeline create-pipeline \
  --cli-input-json file://pipeline-config.json \
  --region us-east-1
```

## Step 8: Test Deployment

```bash
# Push code to GitHub
git add .
git commit -m "Add CI/CD configuration"
git push origin lab15-cicd

# Monitor pipeline
aws codepipeline get-pipeline-state \
  --name image-uploader-pipeline \
  --region us-east-1

# Check deployment status
aws deploy list-deployments \
  --application-name image-uploader \
  --deployment-group-name production \
  --region us-east-1
```

## Verify Deployment

```bash
# SSH to EC2
ssh ec2-user@<instance-ip>

# Check service status
sudo systemctl status demo-app

# View logs
sudo journalctl -u demo-app -f

# Test application
curl http://localhost:3001/api/metadata
```

## Troubleshooting

**CodeDeploy agent not running:**
```bash
sudo systemctl restart codedeploy-agent
sudo systemctl status codedeploy-agent
```

**Deployment failed:**
```bash
# View deployment logs
aws deploy get-deployment \
  --deployment-id d-XXXXXXXXX \
  --region us-east-1

# Check instance logs
sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log
```

**Application not starting:**
```bash
# Check service logs
sudo journalctl -u demo-app -n 100

# Check EFS mount
df -h | grep efs
mountpoint /mnt/efs

# Verify files deployed
ls -la /home/ec2-user/app
```

## Rollback

```bash
# List deployments
aws deploy list-deployments \
  --application-name image-uploader \
  --deployment-group-name production \
  --include-only-statuses Succeeded

# Redeploy previous version
aws deploy create-deployment \
  --application-name image-uploader \
  --deployment-group-name production \
  --revision revisionType=S3,s3Location={bucket=image-uploader-artifacts-ACCOUNT_ID,key=previous-build.zip,bundleType=zip}
```

## Next Steps

- Add CloudWatch alarms for monitoring
- Setup SNS notifications for deployment status
- Add manual approval stage for production
- Configure auto-rollback on failure
- Implement blue/green deployment for zero downtime
