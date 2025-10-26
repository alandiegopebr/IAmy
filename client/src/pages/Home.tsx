import { useState } from 'react';
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
  } = useAI();

  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [activeTab, setActiveTab] = useState('chat');

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

  const handleAskQuestion = () => {
    if (question.trim()) {
      askQuestion(question);
      setQuestion('');
    }
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
            <div className="text-sm text-gray-600">Confiança Média</div>
            <div className="text-3xl font-bold text-purple-600">{Math.round(stats.averageConfidence)}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Sessões Ativas</div>
            <div className="text-3xl font-bold text-orange-600">{stats.sessionCount}</div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">💬 Chat</TabsTrigger>
            <TabsTrigger value="learn">📚 Ensinar</TabsTrigger>
            <TabsTrigger value="knowledge">🧠 Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="proposals">💡 Propostas</TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
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
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleAskQuestion}
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
              </div>
            </Card>
          </TabsContent>

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
        </Tabs>
      </div>
    </div>
  );
}
