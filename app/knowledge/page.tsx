'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  BookOpen,
  FileText,
  Tag,
  Brain,
  Lightbulb,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase, KnowledgeDocument } from '@/lib/supabase-client';
import { CATEGORY_COLORS } from '@/lib/constants';

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeDocument[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('is_published', true)
        .order('title');
      setDocuments((data as KnowledgeDocument[]) || []);
      setLoading(false);
    })();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const q = searchQuery.toLowerCase();
    const results = documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        doc.content.toLowerCase().includes(q) ||
        doc.tags?.some((t) => t.toLowerCase().includes(q)) ||
        doc.category?.toLowerCase().includes(q)
    );
    setSearchResults(results);
    setSearching(false);
  };

  const displayedDocs = searchResults !== null ? searchResults : documents;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Knowledge Base
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Approved departmental procedures, service guidelines, and civic policies. Search for guidance on how specific issues are handled.
        </p>
      </div>

      {/* Search */}
      <Card className="border-border/60 mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for procedures, guidelines, or policies..."
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searching} className="gap-2 bg-navy hover:bg-navy-light">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
            {searchResults !== null && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchResults(null);
                  setSearchQuery('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {searchResults !== null && (
            <p className="mt-3 text-sm text-muted-foreground">
              Found {searchResults.length} document{searchResults.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </p>
          )}
        </CardContent>
      </Card>

      {/* Document List */}
      {displayedDocs.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary mb-4">
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-navy">
              {searchResults !== null ? 'No matching documents' : 'No documents available'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchResults !== null
                ? 'Try a different search term.'
                : 'Knowledge documents will appear here once they are published.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {displayedDocs.map((doc) => {
            const color = doc.category ? CATEGORY_COLORS[doc.category] || '#3b82f6' : '#3b82f6';
            return (
              <Card
                key={doc.id}
                className="card-hover border-border/60 cursor-pointer"
                onClick={() => setSelectedDoc(doc)}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <FileText className="h-5 w-5" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base text-navy">{doc.title}</CardTitle>
                      {doc.category && (
                        <div className="mt-1">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ color, backgroundColor: `${color}15` }}
                          >
                            {doc.category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {doc.content}
                  </p>
                  {doc.source && (
                    <p className="mt-3 text-xs text-muted-foreground">Source: {doc.source}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Document Detail Dialog */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedDoc(null)}
        >
          <Card
            className="border-border/60 max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-lg shrink-0"
                    style={{ backgroundColor: `${CATEGORY_COLORS[selectedDoc.category || ''] || '#3b82f6'}15` }}
                  >
                    <FileText className="h-5 w-5" style={{ color: CATEGORY_COLORS[selectedDoc.category || ''] || '#3b82f6' }} />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-navy">{selectedDoc.title}</CardTitle>
                    {selectedDoc.category && (
                      <span
                        className="inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          color: CATEGORY_COLORS[selectedDoc.category] || '#3b82f6',
                          backgroundColor: `${CATEGORY_COLORS[selectedDoc.category] || '#3b82f6'}15`,
                        }}
                      >
                        {selectedDoc.category}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedDoc.content}</p>
              {selectedDoc.source && (
                <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
                  Source: {selectedDoc.source}
                </p>
              )}
              {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedDoc.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
