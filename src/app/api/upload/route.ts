import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const originalFilename = searchParams.get('filename') || 'image';

    // 1. Unique Naming: Prepend timestamp
    const timestamp = Date.now();
    const filename = `${timestamp}-${originalFilename}`;

    if (!request.body) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    try {
        const blob = await put(filename, request.body, {
            access: 'public',
            // 2. Ensure Vercel Blob adds random suffix for extra collision protection
            addRandomSuffix: true,
        });

        return NextResponse.json(blob);
    } catch (error: any) {
        console.error('Upload Error:', error);
        // 3. Detailed error message
        return NextResponse.json({
            error: 'Upload failed',
            details: error.message || 'Unknown error'
        }, { status: 500 });
    }
}
