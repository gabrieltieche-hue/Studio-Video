import React, { useState } from 'react';
import { 
  Bot, Copy, Check, Terminal, ExternalLink, 
  Sparkles, CheckCircle2, Play, AlertCircle, 
  HelpCircle, Code2, Server, Cpu, ShieldCheck
} from 'lucide-react';

interface ChatGPTModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
}

export const ChatGPTModal: React.FC<ChatGPTModalProps> = ({
  isOpen,
  onClose,
  serverUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'chatgpt_action' | 'mcp_client' | 'tool_runner' | 'architecture'>('chatgpt_action');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedRawJson, setCopiedRawJson] = useState(false);
  const [copiedReplyToGpt, setCopiedReplyToGpt] = useState(false);

  // Tool runner state
  const [selectedTool, setSelectedTool] = useState('studio_status');
  const [toolArgsJson, setToolArgsJson] = useState('{}');
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [toolResult, setToolResult] = useState<any>(null);
  const [toolError, setToolError] = useState<string | null>(null);

  if (!isOpen) return null;

  const publicSharedUrl = 'https://ais-pre-eacgacwlcnlnaupvxvzucq-79011270395.europe-west2.run.app';
  const openApiUrl = `${serverUrl}/api/openapi.json`;
  const mcpSseUrl = `${serverUrl}/api/mcp/sse`;
  const mcpPostUrl = `${serverUrl}/api/mcp`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2500);
  };

  const handleCopyRawOpenApiJson = async () => {
    try {
      const res = await fetch('/api/openapi.json');
      const data = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedRawJson(true);
      setTimeout(() => setCopiedRawJson(false), 2500);
    } catch (e) {
      // Fallback
      copyToClipboard(openApiUrl, setCopiedRawJson);
    }
  };

  // Pre-configured tool examples for interactive test
  const toolPresets: Record<string, string> = {
    studio_status: '{}',
    list_source_videos: '{}',
    download_source_video: '{\n  "url": "https://example.com/interview.mp4",\n  "filename": "interview-take05.mp4"\n}',
    create_short_project: '{\n  "slug": "short-ia-test",\n  "title": "Short Démo 100% IA",\n  "mode": "split_screen_clips",\n  "platform": "instagram"\n}',
    transcribe_short: '{\n  "project_id": "proj-1",\n  "language": "fr"\n}',
    read_short_transcript: '{\n  "project_id": "proj-1"\n}',
    prepare_short: '{\n  "project_id": "proj-1",\n  "cut_silences": true\n}',
    write_motion_component: '{\n  "component_name": "counter_boost",\n  "code": "window.setT = function(t) { document.getElementById(\'c\').innerText = Math.round(t*100); };",\n  "description": "Compteur numérique rapide"\n}',
    render_short: '{\n  "project_id": "proj-1",\n  "quality": "draft",\n  "fps": 30\n}',
    make_reference_contact_sheet: '{\n  "project_id": "proj-1"\n}',
    get_short_outputs: '{\n  "project_id": "proj-1"\n}',
    save_style_profile: '{\n  "name": "Melvyn Dark High-Contrast",\n  "accent_color": "#FF6B00"\n}'
  };

  const handleToolChange = (name: string) => {
    setSelectedTool(name);
    setToolArgsJson(toolPresets[name] || '{}');
    setToolResult(null);
    setToolError(null);
  };

  const handleExecuteTool = async () => {
    setIsExecutingTool(true);
    setToolError(null);
    setToolResult(null);

    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch (e: any) {
        throw new Error(`JSON invalide dans les arguments : ${e.message}`);
      }

      const res = await fetch('/api/studio/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: selectedTool, args: parsedArgs })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l\'exécution');
      }

      setToolResult(data.result);
    } catch (err: any) {
      setToolError(err.message);
    } finally {
      setIsExecutingTool(false);
    }
  };

  const sampleCustomGptPrompt = `Tu es le réalisateur et monteur en chef de Video Agent Studio VF.
Tu disposes d'un studio de production vidéo local connecté via des Actions / MCP (15 commandes exposées).

Règles de travail :
1. Tu vérifies l'état du studio avec \`studio_status\` et listes les vidéos sources avec \`list_source_videos\`.
2. Tu choisis entre le Mode A (Faceless Explainer 100% animé) et le Mode B (Split-Screen Clips 58% animations + sous-titres centrés + 42% vidéo).
3. Tu transcris avec \`transcribe_short\`, sélectionnes les meilleurs passages, prépares l'audio avec \`prepare_short\`.
4. Tu conçois des composants graphiques originaux via \`write_motion_component\` avec la fonction \`window.setT(t)\`.
5. Tu génères le rendu avec \`render_short\`, vérifies le résultat avec \`make_reference_contact_sheet\` (12 frames) et appliques le QC (PASS, REVISE, BLOCKED).
6. Tu respectes les règles de qualité : changement visuel toutes les 1.5s, 18 à 24 temps visuels pour 45s, sous-titres de 2 à 5 mots max.`;

  const mcpConfigSnippet = JSON.stringify({
    mcpServers: {
      "video-agent-studio": {
        "url": mcpSseUrl,
        "type": "sse"
      }
    }
  }, null, 2);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#161619] border border-zinc-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-300">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Connecter Video Agent Studio à ChatGPT
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  MCP & REST API Actifs
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Pilotez le moteur de montage, les 15 commandes et les animations directement depuis ChatGPT.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-[#121214] text-xs px-4">
          <button
            onClick={() => setActiveTab('chatgpt_action')}
            className={`py-3 px-4 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'chatgpt_action'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Option 1 : ChatGPT Custom GPT (Recommandé)</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp_client')}
            className={`py-3 px-4 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'mcp_client'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Option 2 : Protocole MCP (Claude / Cursor / Desktop)</span>
          </button>

          <button
            onClick={() => setActiveTab('tool_runner')}
            className={`py-3 px-4 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'tool_runner'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Console de Test (15 Commandes)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-4 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'architecture'
                ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Guide & Règles VF</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* ============================================================== */}
          {/* TAB 1: CHATGPT CUSTOM GPT ACTIONS (The easiest & most powerful) */}
          {/* ============================================================== */}
          {activeTab === 'chatgpt_action' && (
            <div className="space-y-6">
              {/* Introduction Box */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-emerald-300 block">
                    Comment connecter ChatGPT sans rien installer en local ?
                  </span>
                  <p className="text-zinc-300 leading-relaxed">
                    OpenAI permet à n'importe quel ChatGPT (via les <strong>Custom GPTs / Actions</strong>) d'appeler directement cette application hébergée. Vous n'avez pas besoin d'installer de pont sur votre machine : ChatGPT communique directement avec les endpoints REST / OpenAPI du studio !
                  </p>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-orange-400 flex items-center justify-center font-mono text-[11px]">1</span>
                    Connexion aux Actions Custom GPT de ChatGPT
                  </h3>
                  <button
                    onClick={handleCopyRawOpenApiJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
                    title="Copie le schéma OpenAPI JSON complet pour le coller directement dans le champ 'Schema' de l'Action"
                  >
                    {copiedRawJson ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRawJson ? 'Schéma OpenAPI Copié !' : 'Copier Schéma OpenAPI (JSON)'}</span>
                  </button>
                </div>

                {/* Important Notice about Cloud Run URL & DNS Resolution */}
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Pourquoi ChatGPT a indiqué une erreur de résolution DNS ?</span>
                  </div>
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">
                    L'URL <code className="bg-black/40 px-1 py-0.5 rounded font-mono text-amber-300">ais-dev-...</code> est l'environnement privé interne. OpenAI ne peut pas la résoudre de l'extérieur. Pour connecter ChatGPT sans erreur :
                  </p>
                  <ul className="text-[11px] text-amber-200 list-disc list-inside space-y-1 pl-1">
                    <li><strong>Méthode Recommandée (100% fiable)</strong> : Cliquez sur <em>"Copier Schéma OpenAPI (JSON)"</em> ci-dessus et collez le contenu directement dans le champ <strong>Schema</strong> de votre Action ChatGPT (aucun besoin de résolution DNS !).</li>
                    <li><strong>Ou URL Publique</strong> : Utilisez l'URL publique partagée : <code className="bg-black/50 px-1 py-0.5 rounded font-mono text-white">{publicSharedUrl}/api/openapi.json</code></li>
                  </ul>
                </div>

                <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[11px] font-mono text-zinc-400">URL Publique OpenAPI :</span>
                    <span className="text-xs font-mono text-emerald-300 truncate font-semibold">
                      {publicSharedUrl}/api/openapi.json
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`${publicSharedUrl}/api/openapi.json`, setCopiedUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copié !' : 'Copier l\'URL'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="font-bold text-white block">Étape A : Ouvrir le GPT</span>
                    <p className="text-zinc-400 text-[11px]">
                      Dans ChatGPT, cliquez sur <em>Explore GPTs</em> &gt; Votre GPT (ou <em>Create</em>) &gt; onglet <em>Configure</em>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="font-bold text-white block">Étape B : Coller le Schéma</span>
                    <p className="text-zinc-400 text-[11px]">
                      En bas dans <em>Actions</em>, cliquez sur <em>Create new action</em> et collez le JSON brut dans la grande boîte <em>Schema</em>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="font-bold text-white block">Étape C : 15 Outils Reconnus</span>
                    <p className="text-zinc-400 text-[11px]">
                      ChatGPT valide immédiatement les 15 actions (studio_status, create_short, transcribe, render...).
                    </p>
                  </div>
                </div>
              </div>

              {/* System Prompt for Custom GPT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-orange-400 flex items-center justify-center font-mono text-[11px]">2</span>
                    Instructions à coller dans le GPT (Prompt Système)
                  </h3>
                  <button
                    onClick={() => copyToClipboard(sampleCustomGptPrompt, setCopiedPrompt)}
                    className="flex items-center gap-1 text-xs text-orange-400 hover:underline"
                  >
                    {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPrompt ? 'Copié dans le presse-papier !' : 'Copier tout le prompt'}</span>
                  </button>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                  {sampleCustomGptPrompt}
                </div>
              </div>

              {/* Sample Dialogues */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-white block">Exemples de phrases que vous pouvez dire à ChatGPT :</span>
                <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                  <li><code className="text-orange-400 font-mono">"Vérifie l'état du studio avec studio_status"</code> &rarr; ChatGPT contacte l'application et vous confirme le moteur WebCodecs.</li>
                  <li><code className="text-orange-400 font-mono">"Crée un Short sur le sujet de l'IA en Mode B (Split-Screen) à partir du rush 04"</code> &rarr; ChatGPT initialise le projet et Whisper.</li>
                  <li><code className="text-orange-400 font-mono">"Écris une animation de compteur dynamique pour la frame 8.5s avec write_motion_component"</code> &rarr; L'animation apparaît dans le studio !</li>
                  <li><code className="text-orange-400 font-mono">"Lance un rendu brouillon puis extrait la planche de 12 images"</code> &rarr; ChatGPT lance le rendu et vérifie le contrôle qualité.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: STANDARD MCP CLIENT (Claude Desktop / Cursor / Terminal) */}
          {/* ============================================================== */}
          {activeTab === 'mcp_client' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3">
                <Server className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-blue-300 block">
                    Configuration Model Context Protocol (MCP)
                  </span>
                  <p className="text-zinc-300 leading-relaxed">
                    Ce serveur expose les 15 commandes selon la spécification officielle MCP d'Anthropic / OpenAI (via Server-Sent Events sur <code>/api/mcp/sse</code> et JSON-RPC 2.0 sur <code>/api/mcp</code>).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Fichier de configuration claude_desktop_config.json
                  </span>
                  <button
                    onClick={() => copyToClipboard(mcpConfigSnippet, setCopiedConfig)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium transition"
                  >
                    {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedConfig ? 'Copié !' : 'Copier le JSON'}</span>
                  </button>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-300 leading-relaxed">
                  <pre>{mcpConfigSnippet}</pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                  <span className="font-mono text-orange-400 text-xs block">POST /api/mcp</span>
                  <p className="text-zinc-400 text-[11px]">
                    Endpoint JSON-RPC 2.0 standard acceptant <code>initialize</code>, <code>tools/list</code>, et <code>tools/call</code>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                  <span className="font-mono text-cyan-400 text-xs block">GET /api/mcp/sse</span>
                  <p className="text-zinc-400 text-[11px]">
                    Flux SSE streaming pour les clients persistants (Claude Desktop, Cursor IDE).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: INTERACTIVE TOOL RUNNER (Test any of the 15 tools live) */}
          {/* ============================================================== */}
          {activeTab === 'tool_runner' && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400 leading-relaxed">
                Testez en direct n'importe laquelle des <strong>15 commandes du studio</strong> pour vérifier que le serveur répond instantanément et constater la structure de données retournée.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Tool Selection & Args Input */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Sélectionner une commande MCP :
                    </label>
                    <select
                      value={selectedTool}
                      onChange={(e) => handleToolChange(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-orange-400 focus:outline-none focus:border-orange-500"
                    >
                      {Object.keys(toolPresets).map((tool) => (
                        <option key={tool} value={tool}>
                          {tool}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Arguments (JSON) :
                    </label>
                    <textarea
                      value={toolArgsJson}
                      onChange={(e) => setToolArgsJson(e.target.value)}
                      rows={6}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <button
                    onClick={handleExecuteTool}
                    disabled={isExecutingTool}
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-lg transition shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    <Play className={`w-3.5 h-3.5 ${isExecutingTool ? 'animate-spin' : ''}`} />
                    <span>{isExecutingTool ? 'Exécution en cours...' : `Exécuter "${selectedTool}"`}</span>
                  </button>
                </div>

                {/* Right: Live Result Display */}
                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-3 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[11px] font-mono text-zinc-400">
                    <span>Réponse du serveur local</span>
                    {toolResult && <span className="text-emerald-400 font-bold">200 OK</span>}
                    {toolError && <span className="text-red-400 font-bold">ERREUR</span>}
                  </div>

                  <div className="flex-1 overflow-y-auto py-2 max-h-64 font-mono text-[11px] custom-scrollbar">
                    {toolError && (
                      <div className="p-3 bg-red-950/40 border border-red-900/50 rounded text-red-300">
                        {toolError}
                      </div>
                    )}
                    {toolResult && (
                      <pre className="text-emerald-300 leading-tight">
                        {JSON.stringify(toolResult, null, 2)}
                      </pre>
                    )}
                    {!toolResult && !toolError && (
                      <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                        Cliquez sur "Exécuter" pour lancer la commande.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: STUDIO ARCHITECTURE & QC CRITERIA */}
          {/* ============================================================== */}
          {activeTab === 'architecture' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mode A */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                  <span className="font-bold text-white uppercase text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Mode A — Faceless Explainer
                  </span>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    Création 100% de zéro sans présentateur. Composition d'animations originales : objets 2D/3D, graphiques exponentiels, cartes de données, chronologies et typographie dynamique.
                  </p>
                </div>

                {/* Mode B */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
                  <span className="font-bold text-white uppercase text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    Mode B — Split-Screen Clips
                  </span>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    Transformation de vidéos longues : 55 à 62% d'infographies animées en haut + sous-titres centrés à fort contraste + 38 à 45% de rush vidéo source en bas avec cadrage visage.
                  </p>
                </div>
              </div>

              {/* Quality Standards */}
              <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
                <span className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">
                  Règles de Qualité d'un Short (45 secondes)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-2">
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-lg font-black text-white font-mono block">18-24</span>
                    <span className="text-[10px] text-zinc-400">Temps visuels distincts</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-lg font-black text-white font-mono block">8+</span>
                    <span className="text-[10px] text-zinc-400">Animations originales</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-lg font-black text-white font-mono block">1.5s</span>
                    <span className="text-[10px] text-zinc-400">Changement visuel régulier</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-lg font-black text-white font-mono block">80%</span>
                    <span className="text-[10px] text-zinc-400">Couverture graphique</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-mono text-[11px]">
            VideoAgentStudio v1.0 • WebCodecs • Whisper.cpp • Playwright
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
