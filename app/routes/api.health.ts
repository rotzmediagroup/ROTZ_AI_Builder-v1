import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  return json({
    status: 'healthy',
    service: 'ROTZ',
    path: url.pathname,
    timestamp: new Date().toISOString(),
  });
};
