import { Page } from '@/components/PageLayout';
import { AuthButton } from '../components/AuthButton';

export default function Home() {
  return (
    <Page>
      <Page.Main className="flex flex-col items-center justify-start gap-6 py-6">
        <div className="mb-2 text-center">
          <h1 className="text-2xl font-bold text-primary-800 mb-1">Handcraft</h1>
          <p className="text-sm text-gray-600">Compete in the league and earn rewards!</p>
        </div>

        <AuthButton />

        <div className="mt-4 text-center max-w-sm">
          <div className="flex justify-center gap-3 text-2xl mb-2">
            <span>🧪</span>
            <span>🏆</span>
            <span>✨</span>
          </div>
          <p className="text-sm text-gray-600">
            Create and compete in games with different difficulty levels, collect elemental essences, and climb the league leaderboard!
          </p>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Sign in to start playing
          </p>
        </div>
      </Page.Main>
    </Page>
  );
}
