"use client";
import { useState, useRef, useEffect } from "react";
import {
  Aperture,
  ArrowUpRight,
  Upload,
  Check,
  Plus,
  ChevronRight,
  Sparkles,
  ImageIcon,
  Download,
  X,
  LoaderCircle,
  ShieldCheck,
  Maximize2,
  ArrowRight,
} from "lucide-react";
import { styles, ratios, type Ratio } from "@/lib/styles";
import { importPhoto, prepareReferenceFiles } from "@/lib/import-photo";
import { apiError, timedFetch } from "@/lib/client-api";
import { validateFile, MAX_REFERENCE_PHOTOS } from "@/lib/validation";
type Photo = Awaited<ReturnType<typeof importPhoto>>;
type Reference = {
  id: string;
  name: string;
  key: string;
  preview: string;
  status: "preparing" | "ready" | "error";
  photo?: Photo;
  error?: string;
};
type Result = {
  id: string;
  style: string;
  url?: string;
  error?: string;
  status: "pending" | "processing" | "done" | "error";
  ratio: Ratio;
};
export default function Studio() {
  const [photos, setPhotos] = useState<Reference[]>([]);
  const [selected, setSelected] = useState<string[]>(["proshot"]),
    [ratio, setRatio] = useState<Ratio>("4:5");
  const [importing, setImporting] = useState(false),
    [generating, setGenerating] = useState(false),
    [error, setError] = useState(""),
    [generationError, setGenerationError] = useState("");
  const [results, setResults] = useState<Result[]>([]),
    [viewer, setViewer] = useState<string | null>(null),
    [help, setHelp] = useState(false),
    [password, setPassword] = useState("");
  const [access, setAccess] = useState<"idle" | "checking" | "authorized">(
      "idle",
    ),
    [accessError, setAccessError] = useState(""),
    [accessNotice, setAccessNotice] = useState("");
  const input = useRef<HTMLInputElement>(null),
    passwordInput = useRef<HTMLInputElement>(null),
    importBusy = useRef(false),
    generationBusy = useRef(false),
    mounted = useRef(true),
    photoUrls = useRef(new Set<string>()),
    resultUrls = useRef<string[]>([]),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    timedFetch("/api/access", { signal: abort.signal }, 15000)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted.current && data?.authenticated) setAccess("authorized");
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      abort.abort();
      photoUrls.current.forEach(URL.revokeObjectURL);
      resultUrls.current.forEach(URL.revokeObjectURL);
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!viewer && !help) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewer(null);
        setHelp(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [viewer, help]);
  const readyPhotos = photos.filter((p) => p.status === "ready" && p.photo);
  async function accept(files: File[]) {
    if (!files.length || generationBusy.current || importBusy.current) return;
    setError("");
    const capacity = MAX_REFERENCE_PHOTOS - photos.length;
    if (capacity <= 0) {
      setError("Você já adicionou 10 fotos. Remova uma para adicionar outra.");
      return;
    }
    const messages: string[] = [];
    const incoming: Reference[] = [];
    const originals: File[] = [];
    const keys = new Set(photos.map((p) => p.key));
    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (keys.has(key)) {
        messages.push(`${file.name}: esta foto já foi adicionada.`);
        continue;
      }
      try {
        validateFile(file);
      } catch (e) {
        messages.push(`${file.name}: ${(e as Error).message}`);
        continue;
      }
      if (incoming.length >= capacity) {
        messages.push(
          "Limite de 10 fotos atingido. As fotos excedentes não foram adicionadas.",
        );
        break;
      }
      const preview = URL.createObjectURL(file);
      photoUrls.current.add(preview);
      keys.add(key);
      incoming.push({
        id: crypto.randomUUID(),
        key,
        name: file.name,
        preview,
        status: "preparing",
      });
      originals.push(file);
    }
    setError(messages.join(" "));
    if (!incoming.length) return;
    importBusy.current = true;
    setImporting(true);
    setPhotos((previous) => [...previous, ...incoming]);
    try {
      for (const [index, item] of incoming.entries()) {
        try {
          const photo = await importPhoto(originals[index]);
          URL.revokeObjectURL(item.preview);
          photoUrls.current.delete(item.preview);
          if (!mounted.current) {
            URL.revokeObjectURL(photo.preview);
            return;
          }
          photoUrls.current.add(photo.preview);
          setPhotos((previous) =>
            previous.map((p) =>
              p.id === item.id
                ? { ...p, status: "ready", photo, preview: photo.preview }
                : p,
            ),
          );
        } catch (e) {
          if (mounted.current)
            setPhotos((previous) =>
              previous.map((p) =>
                p.id === item.id
                  ? { ...p, status: "error", error: (e as Error).message }
                  : p,
              ),
            );
        }
      }
    } finally {
      importBusy.current = false;
      if (mounted.current) setImporting(false);
    }
  }
  function removePhoto(id: string) {
    if (importBusy.current || generationBusy.current) return;
    const photo = photos.find((p) => p.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      photoUrls.current.delete(photo.preview);
    }
    setPhotos((previous) => previous.filter((p) => p.id !== id));
    setError("");
  }
  function makePrimary(id: string) {
    setPhotos((previous) => {
      const photo = previous.find((p) => p.id === id);
      return photo ? [photo, ...previous.filter((p) => p.id !== id)] : previous;
    });
  }
  function toggle(id: string) {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((s) => s !== id)
        : [...previous, id],
    );
  }
  function focusAccess() {
    document
      .getElementById("studio-access")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    passwordInput.current?.focus({ preventScroll: true });
  }
  async function enterStudio() {
    if (access === "checking") return false;
    if (!password) {
      setAccessError("Digite a senha do estúdio e clique em Entrar.");
      focusAccess();
      return false;
    }
    setAccess("checking");
    setAccessError("");
    setAccessNotice("");
    try {
      const response = await timedFetch(
        "/api/access",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
        15000,
      );
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json();
      setAccess("authorized");
      setPassword("");
      setAccessNotice(
        data.generationReady
          ? "Senha confirmada. Seu estúdio está liberado."
          : "Senha confirmada. A chave OpenAI ainda precisa ser configurada no servidor.",
      );
      return true;
    } catch (e) {
      setAccess("idle");
      setAccessError((e as Error).message);
      return false;
    }
  }
  async function leaveStudio() {
    try {
      const response = await timedFetch(
        "/api/access",
        { method: "DELETE" },
        15000,
      );
      if (!response.ok) throw new Error(await apiError(response));
      setAccess("idle");
      setPassword("");
      setAccessError("");
      setAccessNotice("");
    } catch (e) {
      setAccessError((e as Error).message);
    }
  }
  async function generate() {
    if (generationBusy.current || importBusy.current) return;
    setGenerationError("");
    if (access !== "authorized" && !(await enterStudio())) {
      setGenerationError("Entre no estúdio para liberar a geração.");
      focusAccess();
      return;
    }
    // Authentication is asynchronous; another click may already have started a run.
    if (generationBusy.current || importBusy.current) return;
    if (!readyPhotos.length) {
      setError("Adicione pelo menos uma foto válida do veículo.");
      input.current?.click();
      return;
    }
    if (!selected.length) {
      setGenerationError("Selecione ao menos um estilo para gerar.");
      return;
    }
    generationBusy.current = true;
    setGenerating(true);
    setError("");
    resultUrls.current.forEach(URL.revokeObjectURL);
    resultUrls.current = [];
    const work = selected.map((style) => ({
      id: crypto.randomUUID(),
      style,
      status: "pending" as const,
      ratio,
    }));
    setResults(work);
    document
      .getElementById("results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    const abort = new AbortController();
    controller.current = abort;
    try {
      const references = await prepareReferenceFiles(
        readyPhotos.map((p) => p.photo!.file),
      );
      for (const item of work) {
        if (abort.signal.aborted) break;
        setResults((previous) =>
          previous.map((r) =>
            r.id === item.id ? { ...r, status: "processing" } : r,
          ),
        );
        try {
          const body = new FormData();
          for (const file of references) body.append("images", file);
          body.append("style", item.style);
          body.append("ratio", ratio);
          const response = await timedFetch(
            "/api/edit",
            { method: "POST", body, signal: abort.signal },
            240000,
          );
          if (!response.ok) {
            const message = await apiError(response);
            if (response.status === 401) {
              setAccess("idle");
              setAccessError(message);
            }
            throw new Error(message);
          }
          if (!response.headers.get("content-type")?.startsWith("image/"))
            throw new Error(
              "O servidor não retornou uma imagem válida. Tente novamente.",
            );
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          resultUrls.current.push(url);
          setResults((previous) =>
            previous.map((r) =>
              r.id === item.id ? { ...r, status: "done", url } : r,
            ),
          );
        } catch (e) {
          const message = abort.signal.aborted
            ? "Geração cancelada."
            : (e as Error).message;
          setGenerationError(message);
          setResults((previous) =>
            previous.map((r) =>
              r.id === item.id ? { ...r, status: "error", error: message } : r,
            ),
          );
          if (
            /configurad|senha|sessão|Entre no estúdio|chave|créditos|verificar sua organização|permissão/i.test(
              message,
            )
          ) {
            setResults((previous) =>
              previous.map((r) =>
                r.status === "pending"
                  ? { ...r, status: "error", error: message }
                  : r,
              ),
            );
            break;
          }
        }
      }
    } catch (e) {
      const message = (e as Error).message;
      setGenerationError(message);
      setResults((previous) =>
        previous.map((r) =>
          r.status === "pending" || r.status === "processing"
            ? { ...r, status: "error", error: message }
            : r,
        ),
      );
    } finally {
      if (abort.signal.aborted)
        setResults((previous) =>
          previous.map((r) =>
            r.status === "pending" || r.status === "processing"
              ? { ...r, status: "error", error: "Geração cancelada." }
              : r,
          ),
        );
      setGenerating(false);
      generationBusy.current = false;
      controller.current = null;
    }
  }
  const finished = results.filter((r) => r.status === "done").length;
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="Auto Vision AI início">
          <span className="brand-icon">
            <Aperture size={25} />
          </span>
          <span>
            AUTO VISION<span className="ai">AI</span>
          </span>
        </a>
        <nav>
          <a className="active" href="#studio">
            Estúdio
          </a>
          <a href="#results">
            Resultados{" "}
            {finished > 0 && <span className="nav-count">{finished}</span>}
          </a>
          <button onClick={() => setHelp(true)}>Como funciona</button>
        </nav>
        <div className="header-right">
          <span className="status-dot" /> Seu estúdio criativo
        </div>
      </header>
      <main id="studio">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> FOTOGRAFIA AUTOMOTIVA, REIMAGINADA
            </div>
            <h1>
              Seu veículo.
              <br />
              Uma nova <span>visão.</span>
            </h1>
            <p>
              Transforme suas fotos em imagens extraordinárias.
              <br className="desktop-br" /> Escolha o cenário. A inteligência
              artificial cuida do resto.
            </p>
          </div>
          <div className="intro-art">
            <img
              src="/styles/hero.jpg"
              alt="Fotografia editorial de um veículo esportivo"
            />
            <div className="art-shade" />
            <div className="art-label">
              <Sparkles size={15} /> A próxima perspectiva é sua{" "}
              <ArrowUpRight size={18} />
            </div>
            <span className="art-corner">AUTO VISION / 01</span>
          </div>
        </section>
        <div className="workspace-heading">
          <div>
            <span className="blue-line" />
            <h2>Crie algo extraordinário</h2>
          </div>
          <span>DA FOTO À NOVA PERSPECTIVA</span>
        </div>
        <section
          className={`studio-access ${access === "authorized" ? "unlocked" : ""}`}
          id="studio-access"
          aria-labelledby="access-title"
        >
          <div className="access-heading">
            <ShieldCheck size={23} />
            <div>
              <h3 id="access-title">Acesso ao estúdio</h3>
              <p>
                {access === "authorized"
                  ? "Sua senha foi validada. Escolha suas fotos e estilos."
                  : "Digite sua senha e confirme para liberar a geração."}
              </p>
            </div>
          </div>
          {access === "authorized" ? (
            <div className="access-approved">
              <span role="status">
                <Check size={17} /> Estúdio liberado
              </span>
              <button
                type="button"
                onClick={() => void leaveStudio()}
                disabled={generating}
              >
                Sair
              </button>
            </div>
          ) : (
            <form
              className="access-form"
              onSubmit={(e) => {
                e.preventDefault();
                void enterStudio();
              }}
            >
              <label htmlFor="password">Senha do estúdio</label>
              <div>
                <input
                  ref={passwordInput}
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAccessError("");
                  }}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  disabled={access === "checking"}
                  aria-describedby={accessError ? "access-error" : undefined}
                />
                <button
                  className="primary"
                  type="submit"
                  disabled={access === "checking"}
                >
                  {access === "checking" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}{" "}
                  {access === "checking" ? "Verificando…" : "Entrar no estúdio"}
                </button>
              </div>
            </form>
          )}
          {accessError && (
            <p id="access-error" className="access-error" role="alert">
              {accessError}
            </p>
          )}
          {accessNotice && (
            <p className="access-notice" role="status">
              {accessNotice}
            </p>
          )}
        </section>
        <div className="workspace">
          <aside className="source-panel">
            <div className="step-heading">
              <span className="step">01</span>
              <h3>Fotos do seu veículo</h3>
              <span className="photo-count">{photos.length}/10</span>
            </div>
            <p className="reference-intro">
              Adicione de 1 a 10 fotos do mesmo carro. Frente, traseira,
              laterais e detalhes ajudam a preservar sua identidade.
            </p>
            <input
              ref={input}
              id="vehicle-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
              className="file-input"
              aria-label="Selecionar fotos do veículo"
              disabled={generating || importing}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                void accept(files);
              }}
            />
            <div
              className={`upload-zone ${photos.length ? "has-photo" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void accept(Array.from(e.dataTransfer.files));
              }}
            >
              {photos.length ? (
                <>
                  <img
                    className="photo-preview"
                    src={photos[0].preview}
                    alt="Foto principal do veículo"
                  />
                  {photos[0].status === "preparing" && (
                    <div className="preparing">
                      <LoaderCircle className="spin" /> Preparando foto…
                    </div>
                  )}
                  {photos[0].status === "error" && (
                    <div className="preparing">
                      Não foi possível abrir esta foto.
                    </div>
                  )}
                  <span className="primary-photo-label">Foto principal</span>
                </>
              ) : (
                <button
                  className="upload-trigger"
                  disabled={generating || importing}
                  onClick={() => input.current?.click()}
                >
                  <span className="upload-icon">
                    <Upload size={27} />
                  </span>
                  <strong>Comece com as fotos do seu carro</strong>
                  <span>
                    Escolha uma ou várias fotos
                    <br />
                    ou arraste suas imagens aqui
                  </span>
                  <span className="upload-action">
                    Selecionar fotografias <Plus size={15} />
                  </span>
                </button>
              )}
            </div>
            <div className="file-meta">
              <ImageIcon size={14} />
              <span>JPG, PNG ou HEIC</span>
              <small>Até 20 MB por foto</small>
            </div>
            {!!photos.length && (
              <>
                <div className="reference-grid">
                  {photos.map((photo, index) => (
                    <div
                      className={`reference-thumb ${index === 0 ? "is-primary" : ""}`}
                      key={photo.id}
                    >
                      <button
                        type="button"
                        className="reference-select"
                        aria-label={`Usar ${photo.name} como foto principal`}
                        aria-pressed={index === 0}
                        disabled={
                          generating || importing || photo.status !== "ready"
                        }
                        onClick={() => makePrimary(photo.id)}
                      >
                        <>
                          {photo.status === "ready" ? (
                            <img
                              src={photo.preview}
                              alt={`Referência ${index + 1}: ${photo.name}`}
                            />
                          ) : (
                            <div className="reference-placeholder">
                              {photo.status === "preparing" ? (
                                <LoaderCircle className="spin" size={20} />
                              ) : (
                                <ImageIcon size={20} />
                              )}
                            </div>
                          )}
                        </>
                        <span>
                          {photo.status === "preparing" ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : photo.status === "error" ? (
                            "Erro"
                          ) : index === 0 ? (
                            "Principal"
                          ) : (
                            `Foto ${index + 1}`
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="remove-reference"
                        onClick={() => removePhoto(photo.id)}
                        disabled={generating || importing}
                        aria-label={`Remover ${photo.name}`}
                      >
                        <X size={13} />
                      </button>
                      {photo.error && <p role="alert">{photo.error}</p>}
                    </div>
                  ))}
                </div>
                <button
                  className="add-references"
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={
                    generating ||
                    importing ||
                    photos.length >= MAX_REFERENCE_PHOTOS
                  }
                >
                  <Plus size={16} />
                  {importing
                    ? "Preparando fotografias…"
                    : photos.length >= MAX_REFERENCE_PHOTOS
                      ? "Limite de 10 fotos atingido"
                      : "Adicionar mais fotos"}
                </button>
                <p className="reference-status" role="status">
                  {readyPhotos.length}{" "}
                  {readyPhotos.length === 1 ? "foto pronta" : "fotos prontas"}
                  {importing ? " · Preparando as demais…" : ""}. Toque em uma
                  miniatura para escolher a principal.
                </p>
              </>
            )}
            {error && (
              <div role="alert" className="error-message">
                {error}
              </div>
            )}
            <div className="source-tip">
              <ShieldCheck size={18} />
              <p>
                Seu carro continua sendo seu carro.
                <br />
                <span>
                  A IA recebe instruções para preservar sua identidade e seus
                  detalhes.
                </span>
              </p>
            </div>
            <div className="ratio-section">
              <div className="step-heading">
                <span className="step">03</span>
                <h3>Proporção da imagem</h3>
              </div>
              <div className="ratio-options">
                {(Object.keys(ratios) as Ratio[]).map((value) => (
                  <button
                    key={value}
                    aria-pressed={ratio === value}
                    className={ratio === value ? "selected" : ""}
                    disabled={generating}
                    onClick={() => setRatio(value)}
                  >
                    <span
                      className="ratio-shape"
                      style={{
                        aspectRatio: value.replace(":", "/"),
                        height: value === "16:9" ? 16 : 24,
                      }}
                    />
                    {value}
                  </button>
                ))}
              </div>
              <p className="muted">
                {ratio === "1:1"
                  ? "Perfeito para posts quadrados"
                  : ratio === "4:5"
                    ? "Perfeito para o feed do Instagram"
                    : ratio === "9:16"
                      ? "Perfeito para Stories e Reels"
                      : "Perfeito para capas e telas amplas"}
              </p>
            </div>
          </aside>
          <section className="styles-panel">
            <div className="styles-heading">
              <div className="step-heading">
                <span className="step">02</span>
                <h3>Escolha sua visão</h3>
              </div>
              <span className="selection-count">
                {selected.length}{" "}
                {selected.length === 1
                  ? "estilo selecionado"
                  : "estilos selecionados"}
              </span>
            </div>
            <p className="styles-description">
              Uma foto, inúmeras possibilidades. Selecione um ou mais estilos.
            </p>
            <div className="style-grid">
              {styles.map((style, i) => (
                <button
                  key={style.id}
                  className={`style-card ${selected.includes(style.id) ? "chosen" : ""}`}
                  onClick={() => toggle(style.id)}
                  disabled={generating}
                  aria-pressed={selected.includes(style.id)}
                >
                  <div className="style-image">
                    <span
                      role="img"
                      aria-label={`Referência visual do estilo ${style.name}`}
                      className="style-reference"
                      style={{
                        backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`,
                      }}
                    />
                    <span className="style-select">
                      {selected.includes(style.id) ? (
                        <Check size={15} />
                      ) : (
                        <Plus size={14} />
                      )}
                    </span>
                    {i === 0 && <span className="recommended">POPULAR</span>}
                  </div>
                  <div className="style-text">
                    <span className="style-tag">{style.tag}</span>
                    <h4>
                      {style.name}
                      <ArrowUpRight size={15} />
                    </h4>
                    <p>{style.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="example-note">
              <ImageIcon size={13} /> Imagens de referência. O resultado será
              criado a partir do seu veículo.
            </div>
          </section>
        </div>
        {generationError && (
          <div className="generation-notice" role="alert">
            <strong>Não foi possível concluir a geração</strong>
            <p>{generationError}</p>
            {access !== "authorized" && (
              <button type="button" onClick={focusAccess}>
                Ir para acesso ao estúdio <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
        <section className="generate-bar">
          <div className="generate-summary">
            <span className="summary-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <strong>
                {generating
                  ? "Criando sua nova visão…"
                  : "Tudo pronto para uma nova visão?"}
              </strong>
              <p>
                {generating
                  ? `${finished} de ${selected.length} versões concluídas`
                  : `${readyPhotos.length} ${readyPhotos.length === 1 ? "foto de referência" : "fotos de referência"} · ${selected.length} ${selected.length === 1 ? "versão" : "versões"} · ${ratio}`}
              </p>
            </div>
          </div>
          <div className="generate-actions">
            {generating ? (
              <button
                className="cancel"
                onClick={() => controller.current?.abort()}
              >
                Cancelar
              </button>
            ) : (
              <span className="generate-hint">
                {!readyPhotos.length
                  ? "Importe fotos para começar"
                  : access !== "authorized"
                    ? "Entre no estúdio para liberar a geração"
                    : !selected.length
                      ? "Selecione ao menos um estilo"
                      : "Cada estilo gera uma edição"}
              </span>
            )}
            <button
              className="primary"
              onClick={() => void generate()}
              disabled={
                !readyPhotos.length ||
                !selected.length ||
                generating ||
                importing ||
                access === "checking"
              }
            >
              {generating ? (
                <LoaderCircle className="spin" size={19} />
              ) : (
                <Sparkles size={19} />
              )}{" "}
              {generating ? "Gerando versões…" : "Gerar minhas imagens"}{" "}
              {!generating && <ArrowRight size={19} />}
            </button>
          </div>
        </section>
        <section id="results" className="results-section">
          <div className="result-heading">
            <div>
              <div className="eyebrow">SUA GALERIA</div>
              <h2>Uma foto. Novas possibilidades.</h2>
            </div>
            <span>
              {finished} {finished === 1 ? "imagem pronta" : "imagens prontas"}
            </span>
          </div>
          {!results.length ? (
            <div className="empty-results">
              <div>
                <ImageIcon size={25} />
              </div>
              <p>Suas próximas grandes fotos começam aqui.</p>
              <span>As imagens geradas aparecerão nesta galeria.</span>
            </div>
          ) : (
            <div className="results-grid">
              {results.map((result) => (
                <article className="result-card" key={result.id}>
                  <div
                    className="result-image"
                    style={{ aspectRatio: result.ratio.replace(":", "/") }}
                  >
                    {result.status === "pending" ||
                    result.status === "processing" ? (
                      <div className="result-state">
                        <LoaderCircle className="spin" />
                        <strong>
                          {result.status === "processing"
                            ? "Editando seu veículo…"
                            : "Aguardando sua vez"}
                        </strong>
                        <span>A edição pode levar alguns minutos.</span>
                      </div>
                    ) : result.url ? (
                      <button
                        onClick={() => setViewer(result.url!)}
                        aria-label="Ampliar resultado"
                      >
                        <img
                          src={result.url}
                          alt={`Seu veículo no estilo ${styles.find((s) => s.id === result.style)?.name}`}
                        />
                        <span className="expand">
                          <Maximize2 size={18} />
                        </span>
                      </button>
                    ) : (
                      <div className="result-state error">
                        <X />
                        <strong>Não foi possível gerar</strong>
                        <span>{result.error}</span>
                      </div>
                    )}
                  </div>
                  <div className="result-caption">
                    <div>
                      <strong>
                        {styles.find((s) => s.id === result.style)?.name}
                      </strong>
                      <span>{result.ratio} · JPEG</span>
                    </div>
                    {result.url && (
                      <a
                        className="download"
                        href={result.url}
                        download={`auto-vision-${result.style}-${result.ratio.replace(":", "x")}.jpg`}
                        aria-label={`Baixar ${result.style}`}
                      >
                        <Download size={19} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <footer>
          <a href="#studio" className="footer-brand">
            <Aperture size={17} /> AUTO VISION AI
          </a>
          <span>Novas perspectivas. A mesma paixão.</span>
          <button onClick={() => setHelp(true)}>
            Guia do estúdio <ChevronRight size={14} />
          </button>
        </footer>
      </main>
      {(viewer || help) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setViewer(null);
            setHelp(false);
          }}
        >
          <div
            className={`modal ${viewer ? "image-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={viewer ? "Visualização da imagem" : "Como funciona"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              autoFocus
              onClick={() => {
                setViewer(null);
                setHelp(false);
              }}
              aria-label="Fechar"
            >
              <X />
            </button>
            {viewer ? (
              <>
                <img src={viewer} alt="Resultado ampliado" />
                <a className="primary" href={viewer} download="auto-vision.jpg">
                  <Download size={18} /> Baixar imagem
                </a>
              </>
            ) : (
              <>
                <div className="eyebrow">AUTO VISION AI</div>
                <h2>Seu estúdio, em três passos.</h2>
                <ol>
                  <li>
                    <strong>Importe seu veículo.</strong>
                    <p>
                      Entre no estúdio e escolha de 1 a 10 fotos JPG, PNG ou
                      HEIC de até 20 MB cada. Use diferentes ângulos do mesmo
                      veículo. A prévia aparece ao importar; arquivos HEIC podem
                      precisar de alguns segundos para conversão.
                    </p>
                  </li>
                  <li>
                    <strong>Escolha sua visão.</strong>
                    <p>
                      Selecione vários cartões e uma proporção. Cada estilo cria
                      uma versão independente.
                    </p>
                  </li>
                  <li>
                    <strong>Gere e baixe.</strong>
                    <p>
                      As edições usam uma API real e podem levar alguns minutos.
                      Revise os detalhes do veículo antes de publicar. A IA pode
                      alterar detalhes mesmo com instruções de preservação.
                    </p>
                  </li>
                </ol>
                <p className="help-note">
                  As fotografias são enviadas à OpenAI apenas ao gerar. Não
                  mantemos fotos em um banco de dados. A geração depende da
                  chave, dos créditos e das políticas da conta da API; há
                  cobrança por edição.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
