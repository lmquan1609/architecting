export const handler = async (event) => {
  // $connect and $disconnect require a 2xx response
  return { statusCode: 200, body: 'OK' };
};
