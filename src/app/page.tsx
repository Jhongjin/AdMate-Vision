'use client';

import { useState, useCallback } from 'react';

export default function Home() {
    const [imageUrl, setImageUrl] = useState('https://via.placeholder.com/750x200?text=AdMate+Vision');
    const [landingUrl, setLandingUrl] = useState('https://admate.co.kr');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string | null>(null); // New state for HTML Mode
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false); // New state for upload
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false); // Drag state

    // Handle Drag Events
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    // Handle File Drop/Select
    const handleFile = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file.');
            return;
        }

        setUploading(true);
        setError(null);
        try {
            const response = await fetch(`/api/upload?filename=${file.name}`, {
                method: 'POST',
                body: file,
            });

            const newBlob = await response.json();
            if (newBlob.url) {
                setImageUrl(newBlob.url);
            } else {
                throw new Error('Upload failed');
            }
        } catch (err: any) {
            setError('Image upload failed: ' + err.message);
        } finally {
            setUploading(false);
            setDragActive(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResultImage(null);
        setHtmlContent(null); // Reset HTML

        try {
            // Get form data directly since we used unchecked select
            const form = e.target as HTMLFormElement;
            const placement = (form.elements.namedItem('media') as HTMLSelectElement).value;

            const res = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    landingUrl,
                    placement // Send selected placement
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate preview');
            }

            if (data.type === 'html') {
                setHtmlContent(data.html);
            } else {
                setResultImage(data.screenshot);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', fontFamily: 'sans-serif', overflow: 'hidden' }}>

            {/* 1. Sidebar (Fixed Width) */}
            <div style={{
                width: '360px',
                flexShrink: 0,
                backgroundColor: '#fff',
                borderRight: '1px solid #e1e1e1',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto',
                boxShadow: '2px 0 10px rgba(0,0,0,0.02)',
                zIndex: 10
            }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#111' }}>AdMate Vision</h1>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Upload Area */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem', color: '#333' }}>Ad Image Source</label>
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            style={{
                                border: dragActive ? '2px dashed #03c75a' : '2px dashed #e1e1e1',
                                borderRadius: '8px',
                                padding: '1.5rem',
                                textAlign: 'center',
                                backgroundColor: dragActive ? '#f0fdf4' : '#fafafa',
                                transition: 'all 0.2s',
                            }}
                        >
                            {uploading ? (
                                <p style={{ color: '#03c75a', fontWeight: 'bold' }}>Uploading...</p>
                            ) : (
                                <>
                                    <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>Drag & drop or</p>
                                    <input
                                        type="file"
                                        id="file-upload"
                                        style={{ display: 'none' }}
                                        onChange={handleChange}
                                        accept="image/*"
                                    />
                                    <label
                                        htmlFor="file-upload"
                                        style={{
                                            display: 'inline-block',
                                            marginTop: '0.5rem',
                                            padding: '0.4rem 0.8rem',
                                            backgroundColor: '#fff',
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                            color: '#333'
                                        }}
                                    >
                                        Browse
                                    </label>
                                </>
                            )}
                        </div>

                        <div style={{ marginTop: '0.8rem' }}>
                            <input
                                type="text"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                                placeholder="http://..."
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Landing URL</label>
                        <input
                            type="text"
                            value={landingUrl}
                            onChange={(e) => setLandingUrl(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
                            required
                        />
                    </div>

                    {/* Placement Select */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Placement Target</label>
                        <select
                            name="media"
                            style={{ width: '100%', padding: '0.7rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem', backgroundColor: '#fff' }}
                        >
                            <option value="mobile_main">네이버 메인 (스페셜 DA)</option>
                            <option value="smart_channel_news">네이버 뉴스 (스마트 채널)</option>
                            <option value="smart_channel_sports">네이버 스포츠 (스마트 채널)</option>
                            <option value="smart_channel_ent">네이버 연예 (스마트 채널)</option>
                            <option value="branding_da_sub">네이버 주제판 (브랜딩 DA)</option>
                            <option value="gfa_feed_news">네이버 GFA 뉴스 피드</option>
                            <option value="gfa_feed_sports">네이버 GFA 스포츠 피드</option>
                            <option value="gfa_feed_ent">네이버 GFA 연예 피드</option>
                            <option value="guarantee_showcase">네이버 보장형 쇼케이스</option>
                            <option value="guarantee_splash">네이버 지도 스플래시</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || uploading}
                        style={{
                            marginTop: '0.5rem',
                            padding: '1rem',
                            fontSize: '1rem',
                            backgroundColor: (loading || uploading) ? '#ccc' : '#03c75a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: (loading || uploading) ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(3, 199, 90, 0.2)'
                        }}
                    >
                        {loading ? 'Generating...' : 'Generate Preview'}
                    </button>

                    {error && (
                        <div style={{ padding: '0.8rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '6px', fontSize: '0.85rem' }}>
                            {error}
                        </div>
                    )}
                </form>
            </div>

            {/* 2. Main Viewer (Flex 1, Centered) */}
            <div style={{
                flex: 1,
                backgroundColor: '#f3f4f6', // Light gray background
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {resultImage || htmlContent ? (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'white',
                            position: 'relative'
                        }}>
                            {/* Mode A: Image Screenshot */}
                            {resultImage && (
                                <a href={landingUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={resultImage}
                                        alt="Generated Preview"
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                    />
                                </a>
                            )}

                            {/* Mode B: HTML Simulation (Iframe) */}
                            {htmlContent && (
                                <iframe
                                    srcDoc={htmlContent}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        backgroundColor: 'white'
                                    }}
                                    title="Ad Simulation"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
                        <p style={{ fontSize: '1.1rem' }}>Select options and click Generate</p>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                body { margin: 0; padding: 0; }
            `}</style>
        </div>
    );
}
