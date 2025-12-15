import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/cron/publish-scheduled
// This endpoint is called by a cron job (e.g., Vercel Cron, GitHub Actions)
// It finds scheduled drafts that are ready to publish and marks them for user action
//
// Note: Actual blockchain publishing requires user wallet signature, so this
// endpoint marks drafts as "ready_to_publish" and creates notifications
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();

    // Find scheduled drafts that are due for publishing
    const { data: dueDrafts, error: fetchError } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled drafts:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled drafts' },
        { status: 500 }
      );
    }

    if (!dueDrafts || dueDrafts.length === 0) {
      return NextResponse.json({
        message: 'No scheduled drafts ready for publishing',
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      readyToPublish: 0,
      errors: [] as { draftId: string; error: string }[],
    };

    for (const draft of dueDrafts) {
      try {
        // Update draft status to indicate it's ready for user to publish
        // The user will need to sign the transaction from their wallet
        const { error: updateError } = await supabase
          .from('content_drafts')
          .update({
            status: 'ready_to_publish',
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Update the corresponding publish job
        const { error: jobError } = await supabase
          .from('publish_jobs')
          .update({
            status: 'ready',
            updated_at: new Date().toISOString(),
          })
          .eq('draft_id', draft.id)
          .eq('status', 'pending');

        if (jobError) {
          console.error('Error updating publish job:', jobError);
        }

        // TODO: Send notification to user (email, push, or in-app)
        // This could integrate with a notification service like:
        // - Supabase Realtime for in-app notifications
        // - SendGrid/Resend for email
        // - Web Push API for browser notifications

        results.readyToPublish++;
        results.processed++;
      } catch (err) {
        results.errors.push({
          draftId: draft.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        results.processed++;
      }
    }

    return NextResponse.json({
      message: `Processed ${results.processed} scheduled drafts`,
      ...results,
    });
  } catch (error) {
    console.error('Error in cron/publish-scheduled:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
