'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface AiPrompt {
    id: string;
    key: string;
    name: string;
    description?: string;
    template: string;
    provider: string;
    category: string;
    version: number;
    isActive: boolean;
    usageCount: number;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
}

const CATEGORIES = [
    'CLASSIFICATION',
    'ANALYSIS',
    'FACT_CHECK',
    'SYSTEM',
    'GENERATION',
    'OTHER',
];

const PROVIDERS = ['xai', 'openai', 'all'];

export default function AiPromptsPage() {
    const { token } = useAuth();
    const [prompts, setPrompts] = useState<AiPrompt[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrompt, setSelectedPrompt] = useState<AiPrompt | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [filter, setFilter] = useState({
        provider: '',
        category: '',
        activeOnly: false,
    });

    // Form state
    const [formData, setFormData] = useState({
        key: '',
        name: '',
        description: '',
        template: '',
        provider: 'xai',
        category: 'ANALYSIS',
    });

    const [updateData, setUpdateData] = useState({
        template: '',
        changeNote: '',
    });

    useEffect(() => {
        if (token) {
            loadPrompts();
        }
    }, [filter, token]);

    const loadPrompts = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const data = await api.getAiPrompts(token, filter);
            setPrompts(data);
        } catch (error) {
            console.error('Failed to load prompts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        try {
            await api.createAiPrompt(token, formData);
            setIsCreating(false);
            setFormData({
                key: '',
                name: '',
                description: '',
                template: '',
                provider: 'xai',
                category: 'ANALYSIS',
            });
            loadPrompts();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPrompt || !token) return;

        try {
            await api.updateAiPrompt(token, selectedPrompt.id, updateData);
            setIsEditing(false);
            setSelectedPrompt(null);
            setUpdateData({ template: '', changeNote: '' });
            loadPrompts();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };

    const toggleActive = async (id: string, isActive: boolean) => {
        if (!token) return;
        try {
            await api.toggleAiPrompt(token, id, isActive);
            loadPrompts();
        } catch (error) {
            console.error('Failed to toggle status:', error);
        }
    };

    const deletePrompt = async (id: string) => {
        if (!token || !confirm('Are you sure you want to delete this prompt?')) return;

        try {
            await api.deleteAiPrompt(token, id);
            loadPrompts();
        } catch (error) {
            console.error('Failed to delete prompt:', error);
        }
    };

    const getCategoryStyles = (category: string) => {
        const styles: Record<string, string> = {
            CLASSIFICATION: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            ANALYSIS: 'bg-green-500/10 text-green-400 border-green-500/20',
            FACT_CHECK: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            SYSTEM: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
            GENERATION: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            OTHER: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
        };
        return styles[category] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    };

    return (
        <DashboardLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-white">AI Prompts</h1>
                        <p className="mt-2 text-slate-400">Manage AI prompt templates and versions</p>
                    </div>
                    <Button
                        onClick={() => setIsCreating(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Prompt
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-wrap gap-6 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Provider</label>
                                <select
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    value={filter.provider}
                                    onChange={(e) => setFilter({ ...filter, provider: e.target.value })}
                                >
                                    <option value="">All Providers</option>
                                    {PROVIDERS.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
                                <select
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    value={filter.category}
                                    onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                                >
                                    <option value="">All Categories</option>
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pb-2">
                                <input
                                    id="activeOnly"
                                    type="checkbox"
                                    checked={filter.activeOnly}
                                    onChange={(e) => setFilter({ ...filter, activeOnly: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50"
                                />
                                <label htmlFor="activeOnly" className="text-sm font-medium text-slate-400 cursor-pointer">
                                    Active Only
                                </label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Prompts List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {prompts.map((prompt) => (
                            <Card key={prompt.id} className="overflow-hidden">
                                <CardHeader className="p-6 border-b border-slate-800 bg-slate-900/50">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-xl font-bold text-white">{prompt.name}</h3>
                                                <span className={`px-2 py-0.5 text-xs font-semibold border rounded-full ${prompt.isActive
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                    }`}>
                                                    {prompt.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <code className="text-indigo-400 font-mono">{prompt.key}</code>
                                                <span className="text-slate-500">v{prompt.version}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedPrompt(prompt);
                                                    setUpdateData({ template: prompt.template, changeNote: '' });
                                                    setIsEditing(true);
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className={prompt.isActive ? 'text-yellow-400' : 'text-green-400'}
                                                onClick={() => toggleActive(prompt.id, prompt.isActive)}
                                            >
                                                {prompt.isActive ? 'Deactivate' : 'Activate'}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="text-red-400"
                                                onClick={() => deletePrompt(prompt.id)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`px-2 py-1 text-xs font-medium border rounded-md ${getCategoryStyles(prompt.category)}`}>
                                            {prompt.category}
                                        </span>
                                        <span className="px-2 py-1 text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 rounded-md">
                                            {prompt.provider}
                                        </span>
                                    </div>

                                    {prompt.description && (
                                        <p className="text-slate-400 text-sm">{prompt.description}</p>
                                    )}

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Template</p>
                                        <div className="bg-slate-950/50 rounded-lg p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap border border-slate-800 max-h-[400px] overflow-y-auto">
                                            {prompt.template}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            Used {prompt.usageCount} times
                                        </div>
                                        {prompt.lastUsedAt && (
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Last used: {new Date(prompt.lastUsedAt).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {prompts.length === 0 && (
                            <div className="text-center py-24 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
                                <p className="text-slate-400 text-lg">No prompts found matching your filters</p>
                                <Button
                                    variant="ghost"
                                    className="text-indigo-400 mt-2"
                                    onClick={() => setFilter({ provider: '', category: '', activeOnly: false })}
                                >
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <CardHeader className="p-6 border-b border-slate-800 flex flex-row items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Create New Prompt</h2>
                                <p className="text-sm text-slate-400">Define a new AI prompt template</p>
                            </div>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </CardHeader>

                        <form onSubmit={handleCreate} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Key (identifier) *</label>
                                    <Input
                                        required
                                        value={formData.key}
                                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                                        placeholder="e.g., content.analysis.sports"
                                        className="bg-slate-800 border-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Name *</label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Human readable name"
                                        className="bg-slate-800 border-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Description</label>
                                <Input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What is this prompt for?"
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Provider *</label>
                                    <select
                                        required
                                        className="w-full bg-slate-800 border-slate-700 rounded-lg text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.provider}
                                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                    >
                                        {PROVIDERS.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400">Category *</label>
                                    <select
                                        required
                                        className="w-full bg-slate-800 border-slate-700 rounded-lg text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-sm font-medium text-slate-400">Template *</label>
                                    <span className="text-xs text-slate-500">Supports {'{{'}variable{'}}'} syntax</span>
                                </div>
                                <textarea
                                    required
                                    value={formData.template}
                                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                                    rows={10}
                                    placeholder="Enter your prompt template here..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <Button
                                    type="submit"
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                >
                                    Create Prompt
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Edit Modal */}
            {isEditing && selectedPrompt && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <CardHeader className="p-6 border-b border-slate-800 flex flex-row items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Edit Prompt: {selectedPrompt.name}</h2>
                                <p className="text-sm text-slate-400">{selectedPrompt.key}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setSelectedPrompt(null);
                                }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </CardHeader>

                        <form onSubmit={handleUpdate} className="p-6 space-y-6">
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                                <div className="flex items-center gap-3 text-indigo-400">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm">
                                        <strong>Versioning:</strong> Current version is {selectedPrompt.version}.
                                        Saving changes will create version {selectedPrompt.version + 1}.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Template *</label>
                                <textarea
                                    required
                                    value={updateData.template}
                                    onChange={(e) => setUpdateData({ ...updateData, template: e.target.value })}
                                    rows={16}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Change Note</label>
                                <Input
                                    value={updateData.changeNote}
                                    onChange={(e) => setUpdateData({ ...updateData, changeNote: e.target.value })}
                                    placeholder="Describe your changes for version control"
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <Button
                                    type="submit"
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                >
                                    Update to Version {selectedPrompt.version + 1}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setSelectedPrompt(null);
                                    }}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </DashboardLayout>
    );
}
