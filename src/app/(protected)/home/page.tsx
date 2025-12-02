import { auth } from '@/auth';
import { EnergyDetailCard } from '@/components/EnergyDetailCard';
// ElementalEssencesDisplay is not used in this component
import { Page } from '@/components/PageLayout';
import { RockPaperScissors } from '@/components/RockPaperScissors';
// import { Button } from '@worldcoin/mini-apps-ui-kit-react';
// import Link from 'next/link';

export default async function Home() {
  // Authentication is handled by the (protected) layout
  await auth();

  return (
    <>
      
      <Page.Main className="flex flex-col items-center justify-start gap-4 mb-16">
        <div className="w-full max-w-md px-4">
          <div className="flex justify-between items-start mb-2">
            <EnergyDetailCard />
          </div>
        </div>
        <RockPaperScissors />
        <div className="mt-8 p-6 bg-gray-100 rounded-lg shadow-sm w-full max-w-md text-center">
          <h2 className="text-xl font-bold">Coming Soon!</h2>
          <p className="text-gray-600 mt-2">New features are on the way. Stay tuned!</p>
        </div>
      </Page.Main>
    </>
  );
}
