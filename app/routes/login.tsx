import { Form, useActionData, useNavigation } from '@remix-run/react';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { requireUser } from '~/lib/auth.server';

export async function loader({ context, request }: LoaderFunctionArgs) {
  try {
    await requireUser(context, request);
    return redirect('/');
  } catch {
    return json({ ok: true });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  const res = await fetch('/api/auth/local/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return json({ error: (data as any)?.error || 'Login failed' }, { status: 401 });
  }

  return redirect('/');
}

export default function Login() {
  const actionData = useActionData<{ error?: string }>();
  const nav = useNavigation();
  const isSubmitting = nav.state === 'submitting';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1 p-6">
      <div className="w-full max-w-sm bg-bolt-elements-background rounded-xl border border-bolt-elements-borderColor p-6 shadow">
        <h1 className="text-xl font-semibold mb-4">Sign in to ROTZ</h1>
        {actionData?.error && <div className="text-red-500 text-sm mb-3">{actionData.error}</div>}
        <Form method="post" className="space-y-3">
          <div>
            <label className="text-sm text-bolt-elements-textSecondary">Email</label>
            <input
              required
              type="email"
              name="email"
              className="w-full mt-1 px-3 py-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
            />
          </div>
          <div>
            <label className="text-sm text-bolt-elements-textSecondary">Password</label>
            <input
              required
              type="password"
              name="password"
              className="w-full mt-1 px-3 py-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2 rounded bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </Form>
      </div>
    </div>
  );
}
