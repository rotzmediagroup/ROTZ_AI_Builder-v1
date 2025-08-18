import { json, redirect, type MetaFunction, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { requireUser } from '~/lib/server/auth';

export const meta: MetaFunction = () => {
  return [
    { title: 'ROTZ' },
    { name: 'description', content: 'Talk with ROTZ, your AI builder' },
  ];
};

export const loader = async ({ context, request }: LoaderFunctionArgs) => {
  try {
    await requireUser(context, request);
    return json({});
  } catch {
    return redirect('/login');
  }
};

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
