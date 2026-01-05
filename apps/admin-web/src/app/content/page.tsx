'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Content } from '@/lib/api';

export default function ContentPage() {
    const { token } = useAuth();
    const [contents, setContents] = useState<Content[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        if (token) {
            loadContent();
        }
    }, [token, statusFilter]);

    async function loadContent() {
        if (!token) return;

        setIsLoading(true);
        try {
            const response = await api.getContents(token, {
                limit: 50,
                status: statusFilter || undefined,
            });
            setContents(response.items);
            setTotal(response.total);
        } catch (error) {
            console.error('Failed to load content:', error);
        } finally {
            setIsLoading(false);
        }
    }

    const statuses = ['pending', 'parsing', 'parsed', 'ai_analyzing', 'ai_analyzed', 'vectorizing', 'ready', 'error'];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Content</h1>
                        <p className="mt-1 text-slate-400">View found content items ({total} total)</p>
                    </div>
                    {/* Add refresh button? */}
                    <Button onClick={() => loadContent()} variant="secondary">
                        Refresh
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">All Statuses</option>
                        {statuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                {/* Content Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : contents.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <h3 className="text-lg font-medium text-white">No content found</h3>
                            <p className="mt-2 text-slate-400">Try changing filters or sync some sources.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {contents.map((content) => (
                            <ContentCard key={content.id} content={content} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

function ContentCard({ content }: { content: Content }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const analysis = content.aiAnalysis;

    return (
        <Card hover>
            <CardContent className="p-5">
                <div className="flex flex-col gap-4">
                    {/* Header Info */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(content.status)}`}>
                                {content.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-500">
                                {new Date(content.createdAt).toLocaleString()}
                            </span>
                            {content.isVectorized && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                    VECTORIZED
                                </span>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 font-mono">ID: {content.id}</p>
                            <p className="text-[10px] text-slate-500 font-mono">Source: {content.sourceId} | Ext: {content.externalId}</p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Original Text */}
                        <div className="md:col-span-1 space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Original Message</h4>
                            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                                {content.text || '(No text content)'}
                            </div>
                        </div>

                        {/* AI Summary / Analysis */}
                        <div className="md:col-span-2 space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Analysis & Summary</h4>
                            {analysis ? (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                                        <p className="text-sm text-slate-200 leading-relaxed italic">
                                            “{analysis.summary}”
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-4 text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 mb-1">Category</span>
                                            <span className="px-2 py-1 rounded bg-slate-800 text-indigo-300 border border-slate-700 capitalize">{analysis.category || 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 mb-1">Sentiment</span>
                                            <span className={`px-2 py-1 rounded bg-slate-800 border border-slate-700 capitalize ${analysis.sentiment === 'positive' ? 'text-green-400' : analysis.sentiment === 'negative' ? 'text-red-400' : 'text-slate-300'}`}>
                                                {analysis.sentiment || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 mb-1">Language</span>
                                            <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">{analysis.language || 'N/A'}</span>
                                        </div>
                                        {analysis.factCheck && (
                                            <div className="flex flex-col">
                                                <span className="text-slate-500 mb-1">Fact Check</span>
                                                <span className={`px-2 py-1 rounded bg-slate-800 border border-slate-700 ${analysis.factCheck.verdict === 'verified' ? 'text-green-400' : analysis.factCheck.verdict === 'refuted' ? 'text-red-400' : 'text-yellow-400'}`}>
                                                    {analysis.factCheck.verdict?.toUpperCase()} ({Math.round(analysis.factCheck.score * 100)}%)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {analysis.keywords && analysis.keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {analysis.keywords.map((kw: string) => (
                                                <span key={kw} className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[10px] text-slate-400 border border-slate-700 hover:border-indigo-500/50 transition-colors">
                                                    #{kw}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center p-8 rounded-lg border border-dashed border-slate-800">
                                    <p className="text-sm text-slate-600">AI Analysis not yet available</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Raw Data Toggle */}
                    <div className="mt-2 border-t border-slate-800/50 pt-3">
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                        >
                            <span>{isExpanded ? 'Hide Raw Data' : 'Show Raw Data'}</span>
                            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        
                        {isExpanded && (
                            <div className="mt-3 p-4 rounded-lg bg-slate-950 font-mono text-[10px] text-slate-400 overflow-x-auto border border-slate-800">
                                <pre>{JSON.stringify({ ...content, embedding: undefined }, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case 'ready': return 'bg-green-500/10 text-green-400';
        case 'error': return 'bg-red-500/10 text-red-400';
        case 'parsed': return 'bg-blue-500/10 text-blue-400';
        case 'ai_analyzed': return 'bg-purple-500/10 text-purple-400';
        default: return 'bg-slate-700 text-slate-400';
    }
}
