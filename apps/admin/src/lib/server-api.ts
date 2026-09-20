export function getApiBaseUrl() {
  return (process.env.KUDI_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

export function getApiReachabilityMessage(error: unknown) {
  const detail = error instanceof Error ? ` (${error.message})` : '';
  return `Admin API is unreachable at ${getApiBaseUrl()}. Check KUDI_API_URL on the admin app and make sure the API service is deployed.${detail}`;
}
