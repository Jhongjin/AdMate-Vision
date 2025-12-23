'use client';

import { useState } from 'react';

export default function Home() {
    const [imageUrl, setImageUrl] = useState('https://via.placeholder.com/750x200?text=AdMate+Vision');
    const [landingUrl, setLandingUrl] = useState('https://admate.co.kr');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResultImage(null);

        try {
            const res = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    landingUrl,
                    media: 'naver_mobile'
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate preview');
            }

            setResultImage(data.screenshot);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>AdMate Vision Generator</h1>

            <form onSubmit={handleSubmit} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '2rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Ad Image URL</label>
                    <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                        required
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Landing URL</label>
                    <input
                        type="text"
                        value={landingUrl}
                        onChange={(e) => setLandingUrl(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        backgroundColor: loading ? '#ccc' : '#03c75a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? 'Generating Preview...' : 'Generate Naver Mobile Preview'}
                </button>

                {error && (
                    <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '4px', marginTop: '1rem' }}>
                        Error: {error}
                    </div>
                )}
            </form>

            {resultImage && (
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '1rem' }}>Preview Result</h2>
                    <div style={{ border: '1px solid #ddd', padding: '10px', display: 'inline-block', borderRadius: '8px' }}>
                        <img
                            src={resultImage}
                            alt="Generated Preview"
                            style={{ maxWidth: '100%', height: 'auto', maxHeight: '80vh', display: 'block' }}
                        />
                    </div>
                    <p style={{ marginTop: '1rem', color: '#666' }}>
                        * This is a simulation on iPhone 13 viewport (m.naver.com)
                    </p>
                </div>
            )}
        </div>
    );
}
