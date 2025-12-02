import { auth } from '@/auth';
import { Navigation } from '@/components/Navigation';
import { Page } from '@/components/PageLayout';
import { Energy } from '@/components/Energy';
import { Marble, TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import GameProviders from '@/providers/GameProviders';

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If the user is not authenticated, redirect to the login page
  if (!session) {
    console.log('Not authenticated');
    // redirect('/');
  }

  return (
    <GameProviders>
      <Page>
        <Page.Header className="p-0">
          <TopBar
            title="Home"
            endAdornment={
              <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                <Energy variant="compact" />
                <p className="text-sm font-semibold capitalize" style={{ maxWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user.username}
                </p>
                <Marble src={session?.user.profilePictureUrl} className="w-12" />
              </div>
            }
          />
        </Page.Header>
        <div className="fixed top-0 right-3 z-50 p-2">

        </div>
        {children}
        <Page.Footer className="px-0 fixed bottom-0 w-full bg-white">
          <Navigation />
        </Page.Footer>
      </Page>
    </GameProviders>
  );
}
