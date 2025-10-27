import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAI } from '@/hooks/useAI';
import { Send, Plus, Download, Upload, Trash2, ThumbsUp, ThumbsDown, Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function Home() {
  const {
    currentSession,
    knowledgeBase,
    stats,
    isLoading,
    addKnowledge,
    askQuestion,
    markFeedback,
    exportData,
    importData,
    clearAll,
    proposals,
    autonomousEnabled,
    setAutonomousLearning,
    approveProposal,
    rejectProposal,
  researchTopic,
  searchKnowledge,
  } = useAI();
  


  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewSelected, setPreviewSelected] = useState<Record<number, boolean>>({});
  // ensure previewSelected defaults to selecting all fragments when previewData is set
  useEffect(() => {
    if (previewData && Object.keys(previewSelected || {}).length === 0) {
      const sel: Record<number, boolean> = {};
      (previewData.fragments || []).forEach((_: any, i: number) => sel[i] = true);
      setPreviewSelected(sel);
    }
  }, [previewData]);
  const [troubleshootInput, setTroubleshootInput] = useState('');
  const [troubleshootResults, setTroubleshootResults] = useState<any[]>([]);

  const handleAddKnowledge = () => {
    if (topic.trim() && content.trim()) {
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
      addKnowledge(topic, content, tagList);
      setTopic('');
      setContent('');
      setTags('');
    }
  };

  const handleInterpret = async () => {
    if (!question.trim()) return alert('Escreva ou cole o texto antes de interpretar');
    // interpretar entrada livre: rodar pesquisa profunda e abrir preview para importação
    setPreviewOpen(false);
    setPreviewData(null);
    try {
      const res = await researchTopic(question, false, { deep: true });
      if (res && res.notFound) {
        alert('Nenhum resultado encontrado na web para esse texto.');
        return;
      }
      if (res && res.data) {
        setPreviewData(res.data);
        const sel: Record<number, boolean> = {};
        (res.data.fragments || []).forEach((_: any, i: number) => sel[i] = true);
        setPreviewSelected(sel);
        setPreviewOpen(true);
      } else if (res && res.proposal) {
        alert('Proposta criada (revisar em Propostas)');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao interpretar/pesquisar. Veja o console para mais detalhes.');
    }
  };

  const handleChatSend = async () => {
    if (!question.trim()) return;
    try {
      // Primeiro: interpretar e tentar aprender automaticamente (auto-approve)
      await researchTopic(question, true);
    } catch (err) {
      console.error('Erro na pesquisa automática:', err);
      // não interromperemos a geração da resposta local
    }
    try {
      // Em seguida, pergunte/ gere resposta usando a base de conhecimento (atualizada)
      await askQuestion(question);
    } catch (err) {
      console.error('Erro ao gerar resposta:', err);
      alert('Erro ao gerar resposta. Veja o console para detalhes.');
    }
    setQuestion('');
  };

  const handleExport = () => {
    const data = exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-knowledge-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          importData(data);
        } catch (error) {
          console.error('Erro ao importar:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os dados?')) {
      clearAll();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🤖 IA com Aprendizado Incremental</h1>
              <p className="text-gray-600 mt-1">Uma IA que aprende com o tempo e armazena conhecimento localmente</p>
            </div>
            {/* Nota: pesquisas usam provedores sem chave por padrão (DuckDuckGo/Bing/Startpage). */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Conhecimentos Aprendidos</div>
            <div className="text-3xl font-bold text-blue-600">{stats.knowledgeCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Interações Totais</div>
            <div className="text-3xl font-bold text-green-600">{stats.totalInteractions}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Sessões Ativas</div>
            <div className="text-3xl font-bold text-orange-600">{stats.sessionCount}</div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="chat">🧭 Interpretar</TabsTrigger>
            <TabsTrigger value="learn">📚 Ensinar</TabsTrigger>
            <TabsTrigger value="knowledge">🧠 Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="proposals">💡 Propostas</TabsTrigger>
              <TabsTrigger value="attachments">📎 Anexos</TabsTrigger>
              <TabsTrigger value="troubleshoot">🛠️ Troubleshoot</TabsTrigger>
          </TabsList>

          {/* Chat Tab (mantém interface de conversa, mas envia para interpretação automática antes de gerar resposta) */}
          <TabsContent value="chat" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Converse com a IA</h2>
              <div className="space-y-4">
                {/* Messages */}
                <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto space-y-3">
                  {currentSession && currentSession.interactions.length > 0 ? (
                    currentSession.interactions.map((interaction) => (
                      <div key={interaction.id} className="space-y-2">
                        {/* Question */}
                        <div className="flex justify-end">
                          <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-xs">
                            {interaction.question}
                          </div>
                        </div>
                        {/* Answer */}
                        <div className="flex justify-start">
                          <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-xs">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{interaction.answer}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-500">Útil?</span>
                              <Button
                                size="sm"
                                variant={interaction.helpful === true ? 'default' : 'outline'}
                                onClick={() => markFeedback(interaction.id, true)}
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={interaction.helpful === false ? 'destructive' : 'outline'}
                                onClick={() => markFeedback(interaction.id, false)}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Nenhuma mensagem ainda. Comece perguntando algo!
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Faça uma pergunta à IA..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleChatSend}
                    disabled={isLoading || !question.trim()}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Attachments / Uploads Tab */}
          <TabsContent value="attachments" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Anexar Arquivos / Livros</h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Envie arquivos de texto ou PDF para que a IA aprenda a partir do conteúdo. Arquivos .txt, .md e .json são processados no cliente; PDFs serão enviados ao servidor para extração de texto.</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.json"
                    multiple
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      try {
                        for (let i = 0; i < files.length; i++) {
                          const f = files[i];
                          const name = f.name.toLowerCase();
                          if (name.endsWith('.txt') || name.endsWith('.md')) {
                            const text = await f.text();
                            const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).slice(0,200);
                            const fragments = paras.map(p => ({ text: p.substring(0,5000), code: [] }));
                            const preview = { topic: f.name, summary: fragments.slice(0,8).map((x:any)=>x.text).join('\n\n---\n\n'), fragments, sources: [`local:${f.name}`] };
                            setPreviewData(preview);
                            const sel: Record<number, boolean> = {};
                            (preview.fragments || []).forEach((_: any, idx: number) => sel[idx] = true);
                            setPreviewSelected(sel);
                            setPreviewOpen(true);
                          } else if (name.endsWith('.json')) {
                            // try to parse JSON as an exported knowledge bundle
                            const txt = await f.text();
                            try {
                              const data = JSON.parse(txt);
                              importData(data);
                              alert(`Arquivo ${f.name} importado para a base de conhecimento.`);
                            } catch (err) {
                              alert(`Arquivo JSON inválido: ${f.name}`);
                            }
                          } else if (name.endsWith('.pdf')) {
                            // upload to server for parsing
                            const fd = new FormData();
                            fd.append('file', f);
                            const resp = await fetch('/api/upload', { method: 'POST', body: fd });
                            if (!resp.ok) {
                              const err = await resp.json().catch(() => ({}));
                              console.error('upload error', err);
                              alert(`Falha ao enviar ${f.name} ao servidor.`);
                              continue;
                            }
                            const body = await resp.json();
                            if (body && body.imported && body.data) {
                              importData(body.data);
                              alert(`Arquivo ${f.name} importado como base de conhecimento.`);
                            } else if (body && body.fragments) {
                              setPreviewData(body);
                              const sel: Record<number, boolean> = {};
                              (body.fragments || []).forEach((_: any, idx: number) => sel[idx] = true);
                              setPreviewSelected(sel);
                              setPreviewOpen(true);
                            } else {
                              alert(`Arquivo ${f.name} processado, mas sem conteúdo extraível.`);
                            }
                          } else {
                            alert(`Formato não suportado: ${f.name}`);
                          }
                        }
                      } catch (err) {
                        console.error('file upload/parse error', err);
                        alert('Erro ao processar arquivos. Veja o console para detalhes.');
                      }
                      // reset input value so same file can be selected again if needed
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Learn Tab */}
          <TabsContent value="learn" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Ensine à IA um novo conceito</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tópico</label>
                  <Input
                    placeholder="Ex: Python, Machine Learning, etc."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                  <Textarea
                    placeholder="Descreva o conceito em detalhes..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isLoading}
                    rows={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (separadas por vírgula)</label>
                  <Input
                    placeholder="Ex: programação, python, tutorial"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={handleAddKnowledge}
                  disabled={isLoading || !topic.trim() || !content.trim()}
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Conhecimento
                </Button>

                <Button
                  onClick={async () => {
                    if (!topic.trim()) return alert('Informe um tópico para pesquisar');
                    try {
                      const res = await researchTopic(topic, true);
                      if (res && res.approved && res.entry) {
                        alert(`Aprendido: ${res.entry.topic}`);
                        setTopic('');
                        setContent('');
                      } else if (res && res.notFound) {
                        alert('Nenhum resultado encontrado na web para esse tópico. Tente outro termo.');
                      } else if (res && !res.approved) {
                        alert('Proposta criada (revisar em Propostas)');
                      }
                    } catch (err: any) {
                      console.error('Erro ao pesquisar (tratado):', err);
                      alert('Erro ao pesquisar. Verifique o servidor ou veja o console para detalhes.');
                    }
                  }}
                  disabled={isLoading || !topic.trim()}
                  className="w-full gap-2 mt-2"
                  variant="outline"
                >
                  <Lightbulb className="w-4 h-4" />
                  Pesquisar e Aprender (web)
                </Button>

                <Button
                  onClick={async () => {
                    if (!topic.trim()) return alert('Informe um tópico para pesquisar');
                    // deep learning: first fetch results for preview, then let user choose which sources to import
                    setPreviewOpen(false);
                    setPreviewData(null);
                    try {
                      const res = await researchTopic(topic, false, { deep: true });
                      if (res && res.notFound) {
                        alert('Nenhum resultado encontrado na web para esse tópico. Tente outro termo.');
                        return;
                      }
                      if (res && res.data) {
                        setPreviewData(res.data);
                        // default: select all sources
                        const sel: Record<number, boolean> = {};
                        (res.data.fragments || []).forEach((_: any, i: number) => sel[i] = true);
                        setPreviewSelected(sel);
                        setPreviewOpen(true);
                      } else {
                        // fallback: if API returned a proposal or other shape
                        if (res && res.proposal) {
                          alert('Proposta criada (revisar em Propostas)');
                        }
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao pesquisar. Veja o console para mais detalhes.');
                    }
                  }}
                  disabled={isLoading || !topic.trim()}
                  className="w-full gap-2 mt-2"
                  variant="default"
                >
                  <Lightbulb className="w-4 h-4" />
                  Aprender Tudo (web)
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Preview Modal for deep research */}
          {previewOpen && previewData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black opacity-40" onClick={() => setPreviewOpen(false)} />
              <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-auto p-6 z-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Pré-visualizar fontes — {previewData.topic} {Object.keys(previewSelected || {}).length > 0 ? `(${Object.values(previewSelected).filter(Boolean).length} selecionados)` : ''}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {(previewData.fragments || []).map((frag: any, idx: number) => {
                    const src = (previewData.sources && previewData.sources[idx]) || null;
                    const text = typeof frag === 'string' ? frag : (frag.text || '');
                    const codes: Array<{ code: string; lang?: string }> = Array.isArray(frag?.code) ? frag.code : [];
                    return (
                      <div key={idx} className="border rounded p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-gray-600">Fonte: {src ? <a className="text-blue-600" href={src} target="_blank" rel="noreferrer">{src}</a> : 'desconhecida'}</div>
                            <h4 className="font-medium mt-2">Trecho</h4>
                          </div>
                          <div>
                            <label className="inline-flex items-center">
                              <input type="checkbox" checked={!!previewSelected[idx]} onChange={(e) => setPreviewSelected(s => ({...s, [idx]: e.target.checked}))} />
                              <span className="ml-2 text-sm">Importar</span>
                            </label>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{text.substring(0, 2000)}</div>
                        {codes.length > 0 && (
                          <div className="mt-3">
                            <h5 className="font-medium">Exemplos de código</h5>
                            {codes.map((c, i) => (
                              <div key={i} className="mt-2">
                                <div className="text-xs text-gray-500">{c.lang || 'código'}</div>
                                <pre className="bg-gray-100 p-3 rounded mt-1 overflow-auto text-sm"><code>{c.code}</code></pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
                  <Button disabled={!Object.values(previewSelected || {}).some(Boolean)} onClick={async () => {
                    // import selected fragments
                    const frags = previewData.fragments || [];
                    const sources = previewData.sources || [];
                    let added = 0;
                    for (let i = 0; i < frags.length; i++) {
                      if (!previewSelected[i]) continue;
                      const frag = frags[i];
                      const fragText = typeof frag === 'string' ? frag : (frag.text || '');
                      const codes: Array<{ code: string; lang?: string }> = Array.isArray(frag?.code) ? frag.code : [];
                      const codeSection = codes.length > 0
                        ? '\n\nExemplos de código:\n' + codes.map(c => `\n\n${c.lang ? '```' + c.lang : '```'}\n${c.code}\n\n\`\`\``).join('\n')
                        : '';
                      const combined = (fragText || '') + codeSection;
                      const src = sources[i] || null;
                      // obter host de forma segura (URLs relativas/faltantes podem lançar)
                      let hostForTitle = '';
                      try {
                        hostForTitle = src ? (new URL(src).host || String(src)) : '';
                      } catch (e) {
                        hostForTitle = src || 'desconhecida';
                      }
                      const topicTitle = src ? `${previewData.topic} — fonte ${hostForTitle}` : previewData.topic;
                      // include language tags when available
                      const codeLangs = codes.map(c => c.lang).filter(Boolean) as string[];
                      const tags = src ? [hostForTitle, ...codeLangs] : [...codeLangs];
                      try {
                        addKnowledge(topicTitle, combined, tags);
                        added++;
                      } catch (err) {
                        console.error('erro ao adicionar conhecimento', err);
                      }
                    }
                    setPreviewOpen(false);
                    setPreviewData(null);
                    setTopic('');
                    setContent('');
                    alert(`Importados ${added} fontes para a base de conhecimento.`);
                  }}>Importar selecionados</Button>
                </div>
              </div>
            </div>
          )}

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-4">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Base de Conhecimento</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                  <label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4" />
                        Importar
                      </span>
                    </Button>
                  </label>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearAll}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Limpar Tudo
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {knowledgeBase.length > 0 ? (
                  knowledgeBase.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{entry.topic}</h3>
                          <p className="text-sm text-gray-600 mt-1">{entry.content.substring(0, 150)}...</p>
                        </div>
                        <Badge variant="secondary">{Math.round(entry.relevance)}% relevância</Badge>
                      </div>
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Nenhum conhecimento armazenado ainda. Comece ensinando à IA!
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Proposals Tab */}
          <TabsContent value="proposals" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Propostas de Aprendizado</h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-gray-600">Aprendizado Autônomo</span>
                  </div>
                  <Switch
                    checked={autonomousEnabled}
                    onCheckedChange={(v) => setAutonomousLearning(Boolean(v))}
                  />
                </div>
              </div>

              {proposals.length === 0 ? (
                <div className="text-center py-8 text-gray-400">Nenhuma proposta pendente.</div>
              ) : (
                <div className="space-y-3">
                  {proposals.map((p) => (
                    <div key={p.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-900">{p.topic}</h3>
                          <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{p.content}</p>
                          {p.sourceInteractionId && (
                            <p className="text-xs text-gray-400 mt-2">Origem: {p.sourceInteractionId}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button size="sm" variant="default" onClick={() => approveProposal(p.id)} className="gap-2">
                            <CheckCircle className="w-4 h-4" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectProposal(p.id)} className="gap-2">
                            <XCircle className="w-4 h-4" /> Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
          {/* Troubleshoot Tab */}
          <TabsContent value="troubleshoot" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Troubleshoot — Problemas do VS Code</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cole aqui o erro / log do VS Code</label>
                  <Textarea
                    placeholder="Cole a saída do terminal, stacktrace ou mensagem de erro do VS Code..."
                    value={troubleshootInput}
                    onChange={(e) => setTroubleshootInput(e.target.value)}
                    rows={8}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => {
                    if (!troubleshootInput.trim()) return alert('Cole o log antes de pesquisar');
                    // busca localmente na base de conhecimento
                    const local = searchKnowledge(troubleshootInput);
                    setTroubleshootResults(local);
                    if (local.length === 0) {
                      alert('Nenhuma solução encontrada localmente. Tente pesquisa web profunda.');
                    }
                  }} className="gap-2">Buscar na base local</Button>
                  <Button variant="outline" onClick={async () => {
                    if (!troubleshootInput.trim()) return alert('Cole o log antes de pesquisar');
                    try {
                      const res = await researchTopic(troubleshootInput, false, { deep: true });
                      if (res && res.notFound) return alert('Nenhuma informação encontrada na web sobre esse erro');
                      if (res && res.data) {
                        // mostrar preview modal reutilizando previewData state
                        setPreviewData(res.data);
                        const sel: Record<number, boolean> = {};
                        (res.data.fragments || []).forEach((_: any, i: number) => sel[i] = true);
                        setPreviewSelected(sel);
                        setPreviewOpen(true);
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Erro ao consultar a web. Veja console.');
                    }
                  }}>Pesquisar web (deep)</Button>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Resultados Locais ({troubleshootResults.length})</h3>
                  <div className="space-y-3 mt-2">
                    {troubleshootResults.length === 0 ? (
                      <div className="text-sm text-gray-500">Sem resultados locais relevantes.</div>
                    ) : (
                      troubleshootResults.map((r, idx) => (
                        <div key={r.id || idx} className="border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold">{r.topic}</div>
                              <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.content.substring(0, 500)}</div>
                            </div>
                            <Badge variant="secondary" className="ml-4">{Math.round(r.relevance)}%</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
