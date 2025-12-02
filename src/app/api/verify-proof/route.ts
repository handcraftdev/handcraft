import { recordVerification } from '@/repositories';
import { auth } from '@/auth';
import {
  ISuccessResult,
  IVerifyResponse,
  verifyCloudProof,
  VerificationLevel,
} from '@worldcoin/minikit-js';
import { NextRequest, NextResponse } from 'next/server';

interface IRequestPayload {
  payload: ISuccessResult;
  action: string;
  signal?: string;
  requestedVerificationLevel?: VerificationLevel;
}

/**
 * This route is used to verify the proof of the user
 * It is critical proofs are verified from the server side
 * Read More: https://docs.world.org/mini-apps/commands/verify#verifying-the-proof
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated session to know which user is verifying
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not authenticated' },
        { status: 401 }
      );
    }

    // Parse the request body
    const { payload, action, signal, requestedVerificationLevel } = (await req.json()) as IRequestPayload;
    
    // Process verification request
    
    // Get App ID from environment variable
    const app_id = process.env.NEXT_PUBLIC_APP_ID;
    if (!app_id || !app_id.startsWith('app_')) {
      return NextResponse.json(
        { error: 'Server configuration error: Invalid APP_ID' },
        { status: 500 }
      );
    }

    // Verify the proof

    try {
      // Verify the proof with World ID's cloud service
      const verifyRes = (await verifyCloudProof(
        payload,
        app_id as `app_${string}`,
        action,
        signal,
      )) as IVerifyResponse;

      // Process the verification result
      if (verifyRes.success) {
        try {
          // Record the successful verification in our database
        // Extract verification level from the payload
        // We don't use this directly, but keep it for reference
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const verificationLevel = payload.verification_level as VerificationLevel;
        
        // Use supabaseId from session if available
        const userId = session.user.supabaseId || session.user.id;
        
        // Process verification data
        
        // Map the requested verification level directly to the correct string value
        let level = "unknown";
        
        // This is the key part: we translate the enum to the exact strings we want in the database
        if (requestedVerificationLevel === VerificationLevel.Device) {
          level = "device";
        } else if (requestedVerificationLevel === VerificationLevel.Orb) {
          level = "orb";
        } else if (typeof payload.verification_level === 'string') {
          // Fallback to payload if no explicit request
          if (payload.verification_level.toLowerCase() === "device") {
            level = "device";
          } else if (payload.verification_level.toLowerCase() === "orb") {
            level = "orb";  
          } else {
            level = payload.verification_level.toLowerCase();
          }
        } 
        
        // Ensure the verification level is valid
        
        // Double check we have a valid level - required per docs
        if (level !== "device" && level !== "orb") {
          // Warning: Verification level isn't one of the expected values, using fallback
          // If everything fails, use a default based on the context
          level = "device"; // Safer fallback than using unknown
        }
        
        // Store the verification in the database
        await recordVerification(userId, {
          verificationLevel: level,
          action,
          // nullifierHash is not available in the standard response - use a placeholder
          nullifierHash: 'verified',
        });
        
        // Return successful response
        return NextResponse.json({ 
          verifyRes, 
          status: 200,
          message: 'Verification successful and recorded'
        });
      } catch (_dbError) {
        // Error storing verification in database
        // Still return success since verification succeeded, even if storing failed
        return NextResponse.json({ 
          verifyRes, 
          status: 200,
          warning: 'Verification successful but failed to record in database'
        });
      }
    } else {
      // Handle verification failures
      return NextResponse.json({
        verifyRes,
        status: 400,
        error: verifyRes.detail || 'Verification failed'
      }, {
        status: 400
      });
    }
    } catch (verifyError) {
      // Error during cloud proof verification
      return NextResponse.json({
        error: 'Error verifying proof',
        details: verifyError instanceof Error ? verifyError.message : 'Unknown verification error'
      }, {
        status: 400
      });
    }
  } catch (error) {
    // Error processing verification
    return NextResponse.json({ 
      error: 'Server error processing verification',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500 
    });
  }
}
