import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE_OG_IMAGE_ALT } from './lib/siteMetadata';

export const alt = SITE_OG_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
    const logoPath = join(process.cwd(), 'public/beengie/beengie-logo.png');
    const logoBuffer = await readFile(logoPath);
    const logoSrc = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 48,
                    background: 'linear-gradient(135deg, #0d1117 0%, #161b22 55%, #1f2937 100%)',
                    padding: 72,
                }}
            >
                <img src={logoSrc} width={220} height={208} alt="" />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        maxWidth: 720,
                    }}
                >
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 700,
                            color: '#ffffff',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                        }}
                    >
                        WatchHive
                    </div>
                    <div
                        style={{
                            fontSize: 34,
                            color: '#9ca3af',
                            marginTop: 20,
                            lineHeight: 1.35,
                        }}
                    >
                        Track movies & TV · Watchlists · Friends
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
