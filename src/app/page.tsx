'use client';

import { useState, useCallback } from 'react';

export default function Home() {
    const [imageUrl, setImageUrl] = useState('https://via.placeholder.com/750x200?text=AdMate+Vision');
    const [landingUrl, setLandingUrl] = useState('https://admate.co.kr');
    const [resultImage, setResultImage] = useState<string | null>(null);
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

            setResultImage(data.screenshot);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#333' }}>AdMate Vision Generator</h1>

            <form onSubmit={handleSubmit} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                padding: '2rem',
                border: '1px solid #e1e1e1',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                backgroundColor: '#fff'
            }}>
                {/* Upload Area */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Ad Image</label>
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        style={{
                            border: dragActive ? '2px dashed #03c75a' : '2px dashed #ccc',
                            borderRadius: '8px',
                            padding: '2rem',
                            textAlign: 'center',
                            backgroundColor: dragActive ? '#f0fdf4' : '#fafafa',
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        {uploading ? (
                            <p style={{ color: '#03c75a', fontWeight: 'bold' }}>Image Uploading...</p>
                        ) : (
                            <>
                                <p style={{ margin: 0, color: '#666' }}>Drag & drop an image here, or</p>
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
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#fff',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    Select File
                                </label>
                            </>
                        )}
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#666' }}>Or paste direct URL:</label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            placeholder="https://..."
                            required
                        />
                    </div>
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

                {/* Placement Select */}
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Placement</label>
                    <select
                        name="media"
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
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
                        marginTop: '1rem',
                        padding: '1rem',
                        fontSize: '1.1rem',
                        backgroundColor: (loading || uploading) ? '#ccc' : '#03c75a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (loading || uploading) ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        transition: 'background-color 0.2s'
                    }}
                >
                    {loading ? 'Generating Preview...' : 'Generate Naver Mobile Preview'}
                </button>

                {error && (
                    <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '4px', textAlign: 'center' }}>
                        {error}
                    </div>
                )}
            </form>

            {resultImage && (
                <div style={{ marginTop: '3rem', textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                    <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Preview Result</h2>

                    <div style={{ display: 'inline-block', position: 'relative' }}>
                        {/* Clickable Wrapper */}
                        <a href={landingUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', cursor: 'pointer', textDecoration: 'none' }}>
                            <div style={{
                                border: '1px solid #e1e1e1',
                                padding: '0',
                                borderRadius: '0',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                backgroundColor: '#fff',
                                display: 'inline-block',
                                width: 'fit-content',
                                overflow: 'hidden'
                            }}>
                                <img
                                    src={resultImage}
                                    alt="Generated Preview"
                                    style={{ maxWidth: '100%', height: 'auto', maxHeight: '80vh', display: 'block' }}
                                />
                            </div>
                        </a>
                        <p style={{ marginTop: '1.5rem', color: '#666', fontSize: '0.95rem' }}>
                            ※ 결과물 이미지를 클릭하면 설정한 랜딩 페이지로 이동합니다
                        </p>
                    </div>
                </div>
            )}

            <style jsx global>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
