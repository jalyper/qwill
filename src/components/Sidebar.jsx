import React, { useState } from 'react';

const Sidebar = ({ isOpen, onClose, files, activeFileId, onSelectFile, onCreateFile, onDeleteFile }) => {
    return (
        <>
            {/* Overlay */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    zIndex: 199,
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    transition: 'opacity 0.3s ease'
                }}
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '300px',
                height: '100vh',
                backgroundColor: 'var(--bg-color)',
                boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
                zIndex: 200,
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem 1rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Recent Files</h2>
                    <button
                        onClick={onCreateFile}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: 'var(--accent-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        + New
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {files.map(file => (
                        <div
                            key={file.id}
                            onClick={() => {
                                onSelectFile(file.id);
                                onClose();
                            }}
                            style={{
                                padding: '1rem',
                                borderRadius: '8px',
                                marginBottom: '0.5rem',
                                cursor: 'pointer',
                                backgroundColor: activeFileId === file.id ? 'rgba(0,0,0,0.05)' : 'transparent',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>
                                {file.name || 'Untitled'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {file.preview || 'No content'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.2rem' }}>
                                {new Date(file.lastModified).toLocaleDateString()} {new Date(file.lastModified).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
