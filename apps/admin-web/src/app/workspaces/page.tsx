'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Workspace } from '@/lib/api';

export default function WorkspacesPage() {
    const { token } = useAuth();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (token) {
            loadWorkspaces();
        }
    }, [token]);

    async function loadWorkspaces() {
        if (!token) return;

        setIsLoading(true);
        try {
            const response = await api.getWorkspaces(token);
            setWorkspaces(response);
        } catch (error) {
            console.error('Failed to load workspaces:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function deleteWorkspace(id: string) {
        if (!token || !confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) return;

        try {
            await api.deleteWorkspace(token, id);
            loadWorkspaces();
        } catch (error) {
            console.error('Failed to delete workspace:', error);
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Workspaces</h1>
                        <p className="mt-1 text-slate-400">Manage your content workspaces</p>
                    </div>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Create Workspace
                    </Button>
                </div>

                {/* Workspaces Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : workspaces.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                            </svg>
                            <h3 className="mt-4 text-lg font-medium text-white">No workspaces yet</h3>
                            <p className="mt-2 text-slate-400">Create your first workspace to get started.</p>
                            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                                Create Workspace
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {workspaces.map((workspace) => (
                            <Card key={workspace.id} hover className="group">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                                <span className="text-white font-bold text-xl">
                                                    {workspace.name[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white text-lg">{workspace.name}</h3>
                                                <p className="text-sm text-slate-400">
                                                    Created {new Date(workspace.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex gap-2">
                                        <Link
                                            href={`/workspaces/${workspace.id}`}
                                            className="flex-1 px-4 py-2 text-sm font-medium text-center text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            Open
                                        </Link>
                                        <Link
                                            href={`/workspaces/${workspace.id}/donors`}
                                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            Donors
                                        </Link>
                                        <Link
                                            href={`/workspaces/${workspace.id}/targets`}
                                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            Targets
                                        </Link>
                                        <button
                                            onClick={() => deleteWorkspace(workspace.id)}
                                            className="px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {showCreateModal && (
                    <CreateWorkspaceModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => {
                            setShowCreateModal(false);
                            loadWorkspaces();
                        }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [name, setName] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token || !name.trim()) return;

        setError('');
        setIsLoading(true);

        try {
            await api.createWorkspace(token, { name: name.trim() });
            onCreated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create workspace');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md">
                <CardHeader className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Create Workspace</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Workspace Name"
                            placeholder="My Project"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1" isLoading={isLoading}>
                                Create
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
