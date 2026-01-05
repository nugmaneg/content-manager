'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Target, CreateTargetData } from '@/lib/api';

export default function WorkspaceTargetsPage() {
    const { id } = useParams();
    const { token } = useAuth();
    const [targets, setTargets] = useState<Target[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (token && id) {
            loadData();
        }
    }, [token, id]);

    async function loadData() {
        if (!token || !id) return;

        setIsLoading(true);
        try {
            const response = await api.getTargets(token, id as string);
            setTargets(response.targets);
        } catch (error) {
            console.error('Failed to load targets:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function toggleActive(target: Target) {
        if (!token || !id) return;

        try {
            await api.updateTarget(token, id as string, target.id, { isActive: !target.is_active });
            loadData();
        } catch (error) {
            console.error('Failed to update target:', error);
        }
    }

    async function deleteTarget(targetId: string) {
        if (!token || !id || !confirm('Delete this target?')) return;

        try {
            await api.deleteTarget(token, id as string, targetId);
            loadData();
        } catch (error) {
            console.error('Failed to delete target:', error);
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href={`/workspaces/${id}`} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Publication Targets</h1>
                        <p className="text-slate-400">Manage channels for publishing content</p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => setShowCreateModal(true)}>
                        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Target
                    </Button>
                </div>

                {/* Targets List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : targets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                            <h3 className="mt-4 text-lg font-medium text-white">No targets yet</h3>
                            <p className="mt-2 text-slate-400">Create a target to start publishing content.</p>
                            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                                Add Target
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {targets.map((target) => (
                            <Card key={target.id} hover>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl">
                                                {target.type === 'telegram' ? '📱' :
                                                    target.type === 'twitter' ? '🐦' : '🌐'}
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-white">{target.name || target.external_id}</h3>
                                                <p className="text-sm text-slate-400">{target.type}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleActive(target)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${target.is_active ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${target.is_active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {target.description && (
                                        <p className="mt-3 text-sm text-slate-400 line-clamp-2">{target.description}</p>
                                    )}

                                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                                        <span>Language: {target.language}</span>
                                        <span>Timezone: {target.timezone}</span>
                                        {target.max_posts_per_day > 0 && (
                                            <span>Max posts/day: {target.max_posts_per_day}</span>
                                        )}
                                        {target.min_post_interval > 0 && (
                                            <span>Min interval: {target.min_post_interval}m</span>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                        <span>ID: {target.external_id}</span>
                                        <button
                                            onClick={() => deleteTarget(target.id)}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create Modal */}
                {showCreateModal && (
                    <CreateTargetModal
                        workspaceId={id as string}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => {
                            setShowCreateModal(false);
                            loadData();
                        }}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}

function CreateTargetModal({ workspaceId, onClose, onCreated }: { workspaceId: string; onClose: () => void; onCreated: () => void }) {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<CreateTargetData>({
        type: 'telegram',
        externalId: '',
        name: '',
        description: '',
        language: 'ru',
        timezone: 'Europe/Moscow',
        maxPostsPerDay: 10,
        minPostInterval: 30,
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return;

        setError('');
        setIsLoading(true);

        try {
            await api.createTarget(token, workspaceId, formData);
            onCreated();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create target');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Create Publication Target</h2>
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
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="telegram">Telegram</option>
                                <option value="twitter">Twitter</option>
                            </select>
                        </div>

                        <Input
                            label="Channel ID / Handle"
                            placeholder={formData.type === 'telegram' ? '@channelname or -100xxx' : '@handle'}
                            value={formData.externalId}
                            onChange={(e) => setFormData({ ...formData, externalId: e.target.value })}
                            required
                        />

                        <Input
                            label="Display Name"
                            placeholder="My Channel"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <Input
                            label="Description"
                            placeholder="Brief description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Language</label>
                                <select
                                    value={formData.language}
                                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="ru">Russian</option>
                                    <option value="en">English</option>
                                    <option value="uk">Ukrainian</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Timezone</label>
                                <select
                                    value={formData.timezone}
                                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="Europe/Moscow">Moscow (UTC+3)</option>
                                    <option value="Europe/Berlin">Berlin (UTC+1)</option>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">New York (UTC-5)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Max posts per day"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.maxPostsPerDay?.toString() || ''}
                                onChange={(e) => setFormData({ ...formData, maxPostsPerDay: parseInt(e.target.value) || undefined })}
                            />
                            <Input
                                label="Min interval (minutes)"
                                type="number"
                                min="1"
                                value={formData.minPostInterval?.toString() || ''}
                                onChange={(e) => setFormData({ ...formData, minPostInterval: parseInt(e.target.value) || undefined })}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1" isLoading={isLoading}>
                                Create Target
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
