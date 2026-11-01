import { createFileRoute } from "@tanstack/react-router";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  Home,
  LayoutGrid,
  Scissors,
  CalendarDays,
  Wallet,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronDown,
  Search,
  MoreVertical,
  Check,
  Heart,
  X,
  Calendar as CalendarIcon,
  Mail,
  UserRound,
  LogOut,
  LoaderCircle,
  LockKeyhole,
  Eye,
  EyeOff,
  ImagePlus,
  Camera,
  Hand,
  Sparkles,
  Ellipsis,
  MapPin,
  NotebookPen,
  Pencil,
  Settings,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Procedimentos Capilares" },
      {
        name: "description",
        content:
          "Um tempo para você. Um diário para lembrar. Registre seus procedimentos e acompanhe seus gastos com beleza.",
      },
    ],
  }),
  component: App,
});

type Entry = {
  id: string;
  procedimento: string;
  categoria: string;
  local: string;
  data: string;
  hora: string;
  valor: number;
  notas?: string;
  evidencia_path?: string | null;
  evidenciaUrl?: string | undefined;
  foto_antes_path?: string | null;
  antesUrl?: string | undefined;
  foto_depois_path?: string | null;
  depoisUrl?: string | undefined;
};
/** Fotos novas escolhidas no formulário (só as trocadas). */
type EntryPhotos = { evidencia?: File; antes?: File; depois?: File };
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;

async function signEvidence(path?: string | null) {
  if (!path) return undefined;
  const { data } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60);
  return data?.signedUrl;
}
/** Gera os links temporários das três fotos do registro (evidência, antes e depois). */
async function withPhotoUrls(entry: Entry): Promise<Entry> {
  const [evidenciaUrl, antesUrl, depoisUrl] = await Promise.all([
    signEvidence(entry.evidencia_path),
    signEvidence(entry.foto_antes_path),
    signEvidence(entry.foto_depois_path),
  ]);
  return { ...entry, evidenciaUrl, antesUrl, depoisUrl };
}
type View = "painel" | "procedimentos" | "gastos" | "novo" | "config";
type Profile = {
  nome: string;
  cidade: string;
  foto_path: string | null;
  fotoUrl?: string | undefined;
};

const EMPTY_PROFILE: Profile = { nome: "", cidade: "", foto_path: null };
const PHOTO_URL_TTL = 60 * 60 * 24;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const CATEGORIAS = ["Cabelo", "Unhas", "Sobrancelha", "Estética", "Outros"];
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Cabelo: Scissors,
  Unhas: Hand,
  Sobrancelha: Eye,
  Estética: Sparkles,
  Outros: Ellipsis,
};
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const NAV = [
  { id: "painel", label: "Painel", icon: LayoutGrid },
  { id: "procedimentos", label: "Procedimentos", icon: Scissors },
  { id: "gastos", label: "Gastos", icon: Wallet },
] as const;
const SELECT_FIELDS =
  "id, procedimento, categoria, local, data, hora, valor, notas, evidencia_path, foto_antes_path, foto_depois_path";
const RING = 2 * Math.PI * 50;

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const prettyDate = (s: string) =>
  new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Valor em reais com os centavos atenuados, como nas referências. */
function Money({ value }: { value: number }) {
  const formatted = money(value);
  const comma = formatted.lastIndexOf(",");
  return (
    <>
      {formatted.slice(0, comma)}
      <span className="cents">{formatted.slice(comma)}</span>
    </>
  );
}

/** Foto salva em Configurações; sem foto, as iniciais do nome. */
function Avatar({
  profile,
  size,
  className,
}: {
  profile: Profile | null;
  size: number;
  className: string;
}) {
  if (profile?.fotoUrl)
    return <img className={className} src={profile.fotoUrl} alt="" width={size} height={size} />;
  const initials = (profile?.nome ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`${className} avatar-initials`}
      style={{ fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** Miniatura que amplia a foto ao tocar. */
function PhotoThumb({ src, label, className }: { src: string; label: string; className: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className={className} aria-label={`Ampliar foto: ${label}`}>
          <img src={src} alt="" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="lightbox" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <img src={src} alt={label} />
          <Dialog.Close className="modal-close" aria-label="Fechar foto">
            <X size={19} aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Quadro para escolher a foto de Antes ou Depois no formulário. */
function PhotoTile({
  label,
  preview,
  accent = false,
  onPick,
}: {
  label: string;
  preview: string;
  accent?: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={`ba-tile ${accent ? "accent" : ""} ${preview ? "filled" : ""}`}
        aria-label={preview ? `Trocar foto: ${label}` : `Adicionar foto: ${label}`}
        onClick={() => input.current?.click()}
      >
        {preview ? (
          <>
            <img src={preview} alt="" />
            <span className="ba-tag">{label}</span>
          </>
        ) : (
          <>
            <Camera size={22} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Escolher foto: ${label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
    </>
  );
}

function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICONS[category] ?? Ellipsis;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem("diario-salao-v1");
    } catch {
      // Browsers with storage disabled already cannot retain the legacy records.
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (checkingSession) return <AppLoading label="Abrindo seu diário…" />;
  if (!session) return <LoginPage />;
  return (
    <Index
      userId={session.user.id}
      userEmail={session.user.email ?? ""}
      signupName={String(session.user.user_metadata?.["nome"] ?? "").trim()}
      onSignOut={() => void supabase.auth.signOut()}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Login e cadastro                                                    */
/* ------------------------------------------------------------------ */

function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = themeColor?.content;
    themeColor?.setAttribute("content", "#000000");
    return () => {
      if (themeColor && previous) themeColor.content = previous;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    setSending(true);
    setError("");
    const credentials = { email: email.trim(), password };
    const { error: authError } =
      mode === "signup"
        ? await supabase.auth.signUp({
          ...credentials,
          options: { data: { nome: name.trim() } },
        })
        : await supabase.auth.signInWithPassword(credentials);
    setSending(false);
    if (authError) {
      setError(
        mode === "signup"
          ? "Não foi possível criar a conta. Talvez este e-mail já esteja cadastrado."
          : "E-mail ou senha incorretos. Confira os dados e tente novamente.",
      );
    }
  }

  function changeMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  const isSignup = mode === "signup";

  return (
    <main className="login">
      <picture className="login-photo">
        <source media="(min-width: 900px)" srcSet="/images/login-desktop.png" />
        <img src="/images/login-mobile.png" alt="" />
      </picture>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-box">
          <h1 id="login-title">{isSignup ? "Crie sua conta" : "Entre com a sua conta"}</h1>
          <p className="login-sub">
            {isSignup
              ? "Crie seu diário pessoal de beleza para registrar "
              : "Diário pessoal de beleza para registrar "}
            <b>procedimentos</b> e acompanhar <b>gastos</b>.
          </p>
          {!hasSupabaseConfig ? (
            <p className="login-error" role="alert">
              A conexão com o banco ainda não foi configurada.
            </p>
          ) : (
            <form onSubmit={submit}>
              {isSignup && (
                <label className="login-field">
                  <UserRound size={20} aria-hidden="true" />
                  <span className="sr-only">Nome</span>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nome"
                  />
                </label>
              )}
              <label className="login-field">
                <Mail size={20} aria-hidden="true" />
                <span className="sr-only">E-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="E-mail"
                />
              </label>
              <label className="login-field">
                <LockKeyhole size={20} aria-hidden="true" />
                <span className="sr-only">Senha</span>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Senha"
                />
                <button
                  type="button"
                  className="login-eye"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </label>
              {isSignup && (
                <p className="login-help">
                  Use pelo menos 8 caracteres e evite senhas utilizadas em outros sites.
                </p>
              )}
              <p className="login-error" role="alert">
                {error}
              </p>
              <button className="login-submit" disabled={sending}>
                {sending && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
                {sending ? "Aguarde…" : isSignup ? "Criar minha conta" : "Entrar"}
              </button>
            </form>
          )}
          <p className="login-switch">
            {isSignup ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
            <button type="button" onClick={() => changeMode(isSignup ? "login" : "signup")}>
              {isSignup ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

function AppLoading({ label }: { label: string }) {
  return (
    <div className="app-loading" role="status">
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aplicativo                                                          */
/* ------------------------------------------------------------------ */

function Index({
  userId,
  userEmail,
  signupName,
  onSignOut,
}: {
  userId: string;
  userEmail: string;
  signupName: string;
  onSignOut: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [view, setView] = useState<View>("painel");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [draftCategory, setDraftCategory] = useState("Cabelo");
  const [draftProcedure, setDraftProcedure] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [spendingCategory, setSpendingCategory] = useState("Cabelo");
  const [annualSpendingYear, setAnnualSpendingYear] = useState(() => new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState(() => new Date().getMonth());
  const [historyYear, setHistoryYear] = useState(() => new Date().getFullYear());
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  // null enquanto o perfil não carrega: nada de nome ou foto provisórios.
  const [profile, setProfile] = useState<Profile | null>(null);
  // Lugar no cabeçalho de Novo/Editar registro onde aparecem os quadros Antes e Depois.
  const [photoSlot, setPhotoSlot] = useState<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    void supabase
      .from("registros")
      .select(SELECT_FIELDS)
      .order("data", { ascending: false })
      .order("hora", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStorageError(
            "Não foi possível carregar seus registros. Tente novamente em instantes.",
          );
          return;
        }
        const loadedEntries = (data ?? []).map((entry) => ({
          ...entry,
          valor: Number(entry.valor),
          hora: entry.hora.slice(0, 5),
        })) as Entry[];
        void Promise.all(loadedEntries.map(withPhotoUrls)).then(
          (resolved) => active && setEntries(resolved),
        );
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void supabase
      .from("perfis")
      .select("nome, cidade, foto_path")
      .maybeSingle()
      .then(async ({ data }) => {
        if (!active) return;
        if (!data) {
          const nome = signupName || userEmail.split("@")[0] || "";
          setProfile({ ...EMPTY_PROFILE, nome });
          // Primeiro acesso: guarda o nome do cadastro no perfil desta conta.
          if (signupName)
            // As consultas do Supabase só executam ao serem aguardadas: daí o .then().
            void supabase
              .from("perfis")
              .insert({ user_id: userId, nome: signupName, cidade: "" })
              .then(() => undefined);
          return;
        }
        const fotoUrl = data.foto_path
          ? (
            await supabase.storage
              .from("fotos-perfil")
              .createSignedUrl(data.foto_path, PHOTO_URL_TTL)
          ).data?.signedUrl
          : undefined;
        if (active)
          setProfile({
            nome: data.nome || signupName || userEmail.split("@")[0] || "",
            cidade: data.cidade,
            foto_path: data.foto_path,
            fotoUrl,
          });
      });
    return () => {
      active = false;
    };
  }, [userId, userEmail, signupName]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(next: View) {
    setView(next);
    setPendingDelete(null);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus());
  }
  function newEntry(category = "Cabelo", procedure = "") {
    setEditingEntry(null);
    setDraftCategory(category);
    setDraftProcedure(procedure);
    navigate("novo");
  }
  function editEntry(entry: Entry) {
    setEditingEntry(entry);
    setDraftCategory(entry.categoria);
    setDraftProcedure(entry.procedimento);
    navigate("novo");
  }

  const currentYear = new Date().getFullYear();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthly = entries.filter((e) => e.data.startsWith(monthKey));
  const total = monthly.reduce((s, e) => s + e.valor, 0);
  const yearTotal = entries
    .filter((e) => e.data.startsWith(String(year)))
    .reduce((s, e) => s + e.valor, 0);
  const currentYearTotal = entries
    .filter((e) => e.data.startsWith(String(currentYear)))
    .reduce((s, e) => s + e.valor, 0);
  const availableYears = Array.from(
    new Set([currentYear, ...entries.map((entry) => Number(entry.data.slice(0, 4)))]),
  ).sort((a, b) => b - a);
  const annualEntries = entries.filter((entry) =>
    entry.data.startsWith(String(annualSpendingYear)),
  );
  const annualTotal = annualEntries.reduce((sum, entry) => sum + entry.valor, 0);
  const historyKey = `${historyYear}-${String(historyMonth + 1).padStart(2, "0")}`;
  const selectedCategoryEntries = entries.filter(
    (entry) => entry.data.startsWith(historyKey) && entry.categoria === spendingCategory,
  );
  const selectedCategoryTotal = selectedCategoryEntries.reduce(
    (sum, entry) => sum + entry.valor,
    0,
  );
  const list = useMemo(
    () =>
      [...entries]
        .filter(
          (e) =>
            `${e.procedimento} ${e.categoria} ${e.local}`
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR")) &&
            (!filter || e.categoria === filter),
        )
        .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora)),
    [entries, search, filter],
  );
  const listTotal = list.reduce((sum, entry) => sum + entry.valor, 0);
  const monthShare = yearTotal ? total / yearTotal : 0;

  async function remove(id: string) {
    const removed = entries.find((entry) => entry.id === id);
    const photoPaths = [
      removed?.evidencia_path,
      removed?.foto_antes_path,
      removed?.foto_depois_path,
    ].filter((path): path is string => Boolean(path));
    const { error } = await supabase.from("registros").delete().eq("id", id);
    if (error) {
      setStorageError("Não foi possível excluir este registro. Tente novamente.");
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (photoPaths.length) void supabase.storage.from("evidencias").remove(photoPaths);
    setPendingDelete(null);
    setNotice("Registro excluído.");
  }
  const deletion = { pending: pendingDelete, setPending: setPendingDelete, remove };

  async function save(entry: Entry, photos: EntryPhotos) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("not authenticated");
    const ownerId = auth.user.id;
    const fields = {
      evidencia: "evidencia_path",
      antes: "foto_antes_path",
      depois: "foto_depois_path",
    } as const;
    const paths = {
      evidencia_path: editingEntry?.evidencia_path ?? null,
      foto_antes_path: editingEntry?.foto_antes_path ?? null,
      foto_depois_path: editingEntry?.foto_depois_path ?? null,
    };
    const uploaded: string[] = [];
    const replaced: string[] = [];
    try {
      for (const key of ["evidencia", "antes", "depois"] as const) {
        const file = photos[key];
        if (!file) continue;
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("evidencias")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        const previous = paths[fields[key]];
        if (previous) replaced.push(previous);
        paths[fields[key]] = path;
      }
    } catch (uploadError) {
      if (uploaded.length) await supabase.storage.from("evidencias").remove(uploaded);
      throw uploadError;
    }
    const values = {
      procedimento: entry.procedimento,
      categoria: entry.categoria,
      local: entry.local,
      data: entry.data,
      hora: entry.hora,
      valor: entry.valor,
      notas: entry.notas || null,
      ...paths,
    };
    const query = editingEntry
      ? supabase.from("registros").update(values).eq("id", editingEntry.id)
      : supabase.from("registros").insert(values);
    const { data, error } = await query.select(SELECT_FIELDS).single();
    if (error || !data) {
      if (uploaded.length) await supabase.storage.from("evidencias").remove(uploaded);
      throw new Error("save failed");
    }
    const saved = await withPhotoUrls({
      ...data,
      valor: Number(data.valor),
      hora: data.hora.slice(0, 5),
    } as Entry);
    // Fotos trocadas: apaga as antigas só depois de o registro salvar com sucesso.
    if (replaced.length) void supabase.storage.from("evidencias").remove(replaced);
    setEntries((old) =>
      editingEntry
        ? old.map((current) => (current.id === editingEntry.id ? saved : current))
        : [...old, saved],
    );
    setMonth(new Date(`${entry.data.slice(0, 7)}-01T12:00:00`));
    setNotice(editingEntry ? "Registro atualizado!" : "Registro salvo com carinho!");
    setEditingEntry(null);
    navigate("procedimentos");
  }

  async function saveProfile(values: { nome: string; cidade: string }, photo?: File) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("not authenticated");
    const current = profile ?? EMPTY_PROFILE;
    let fotoPath = current.foto_path;
    let uploadedPath: string | null = null;
    if (photo) {
      const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      uploadedPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("fotos-perfil")
        .upload(uploadedPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) throw uploadError;
      fotoPath = uploadedPath;
    }
    const { error } = await supabase.from("perfis").upsert({
      user_id: auth.user.id,
      nome: values.nome,
      cidade: values.cidade,
      foto_path: fotoPath,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      if (uploadedPath) await supabase.storage.from("fotos-perfil").remove([uploadedPath]);
      throw error;
    }
    if (uploadedPath && current.foto_path && current.foto_path !== uploadedPath) {
      void supabase.storage.from("fotos-perfil").remove([current.foto_path]);
    }
    let fotoUrl = current.fotoUrl;
    if (uploadedPath) {
      const { data: signed } = await supabase.storage
        .from("fotos-perfil")
        .createSignedUrl(uploadedPath, PHOTO_URL_TTL);
      fotoUrl = signed?.signedUrl;
    }
    setProfile({ ...values, foto_path: fotoPath, fotoUrl });
    setNotice("Configurações salvas!");
  }

  const topbar = (
    <Topbar
      view={view}
      profile={profile}
      userEmail={userEmail}
      onNavigate={navigate}
      onNew={() => newEntry()}
      onSignOut={onSignOut}
    />
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <aside className="sidebar" aria-label="Menu principal">
        <div className="sidebar-logo">
          <span aria-hidden="true">J</span>
          <b>Jéssica Salão</b>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className="side-link"
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => navigate(item.id)}
          >
            <item.icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          className="side-link side-new"
          aria-current={view === "novo" ? "page" : undefined}
          onClick={() => newEntry()}
          disabled={!loaded}
        >
          <Plus size={20} aria-hidden="true" />
          <span>Novo registro</span>
        </button>
        <button
          className="side-link side-config"
          aria-current={view === "config" ? "page" : undefined}
          onClick={() => navigate("config")}
        >
          <Settings size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>Configurações</span>
        </button>
        <div className="side-me">
          <Avatar profile={profile} size={42} className="side-photo" />
          <div>
            <b>{profile?.nome}</b>
            <small title={userEmail}>{profile ? profile.cidade || userEmail : ""}</small>
          </div>
          <button aria-label="Sair do diário" title="Sair do diário" onClick={onSignOut}>
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main id="conteudo" className={`page page-${view}`}>
        {storageError && (
          <div className="banner-error" role="alert">
            {storageError}
          </div>
        )}

        {view === "painel" && (
          <>
            <header className="hd hd-painel">
              {topbar}
              <div className="hd-in hd-welcome">
                <p className="welcome-hi">
                  Bem-vinda(o),
                  <strong className="welcome-name">{profile?.nome ?? " "}</strong>
                </p>
                <Avatar profile={profile} size={112} className="welcome-photo" />
                <div>
                  <h1 ref={heading} tabIndex={-1}>
                    Procedimentos <span>de Beleza</span>
                  </h1>
                  <p>Cada cuidado faz parte da sua história.</p>
                </div>
              </div>
            </header>
            <div className="body">
              <div className="menu">
                <button className="menu-card" onClick={() => navigate("procedimentos")}>
                  <span className="round-ic">
                    <Scissors size={22} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span>
                    <b>Procedimentos</b>
                    <small>{loaded ? plural(entries.length, "registro") : "Carregando…"}</small>
                  </span>
                </button>
                <button className="menu-card" onClick={() => navigate("gastos")}>
                  <span className="round-ic">
                    <Wallet size={22} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span>
                    <b>Gastos</b>
                    <small>{money(currentYearTotal)} no ano</small>
                  </span>
                </button>
              </div>
              <div className="sec">
                <h2>Categorias</h2>
                <span>O que vamos cuidar hoje?</span>
              </div>
              <div className="cats">
                {CATEGORIAS.map((category) => (
                  <button
                    key={category}
                    className="cat"
                    onClick={() => newEntry(category, category)}
                    aria-label={`Novo registro: ${category}`}
                  >
                    <span>
                      <CategoryIcon category={category} size={22} />
                    </span>
                    {category}
                  </button>
                ))}
              </div>
              <button className="cta cta-float" onClick={() => newEntry()} disabled={!loaded}>
                <Plus size={19} aria-hidden="true" /> Novo registro
              </button>
            </div>
          </>
        )}

        {view === "procedimentos" && (
          <>
            <header className="hd">
              {topbar}
              <div className="hd-in hd-split">
                <div>
                  <h1 ref={heading} tabIndex={-1}>
                    Procedimentos
                  </h1>
                  <p>Cada cuidado faz parte da sua história.</p>
                </div>
                <div className="hd-total">
                  <span className="lab">Total listado</span>
                  <strong className="big">
                    <Money value={listTotal} />
                  </strong>
                  <p>
                    {plural(list.length, "registro")} {list.length === 1 ? "listado" : "listados"}
                  </p>
                  <div className="hd-cats" role="group" aria-label="Filtrar por categoria">
                    {CATEGORIAS.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className="hd-cat"
                        aria-pressed={filter === category}
                        onClick={() => setFilter(filter === category ? "" : category)}
                      >
                        <span>
                          <CategoryIcon category={category} size={20} />
                        </span>
                        <small>{category}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>
            <div className="body">
              <div className="card tools">
                <label className="search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    aria-label="Buscar procedimentos"
                    placeholder="Buscar procedimento ou salão"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="chips" role="group" aria-label="Filtrar por categoria">
                  {["", ...CATEGORIAS].map((option) => (
                    <button
                      key={option || "todas"}
                      type="button"
                      className="chip"
                      aria-pressed={filter === option}
                      onClick={() => setFilter(option)}
                    >
                      {option || "Todas"}
                    </button>
                  ))}
                </div>
              </div>
              <ProceduresByMonth
                items={list}
                deletion={deletion}
                loaded={loaded}
                onEdit={editEntry}
              />
            </div>
          </>
        )}

        {view === "gastos" && (
          <>
            <header className="hd">
              {topbar}
              <div className="hd-in hd-split hd-gastos">
                <div>
                  <h1 ref={heading} tabIndex={-1}>
                    Gastos
                  </h1>
                  <p>
                    {plural(monthly.length, "procedimento")} em {MONTHS[monthIndex]?.toLowerCase()}{" "}
                    de {year}
                  </p>
                  <div className="pills">
                    <PillSelect
                      label="Mês"
                      value={monthIndex}
                      onChange={(value) => setMonth(new Date(year, Number(value), 1))}
                      options={MONTHS.map((label, index) => ({ value: index, label }))}
                      accent
                    />
                    <PillSelect
                      label="Ano"
                      value={year}
                      onChange={(value) => setMonth(new Date(Number(value), monthIndex, 1))}
                      options={availableYears.map((y) => ({ value: y, label: String(y) }))}
                    />
                  </div>
                </div>
                <div
                  className="donut"
                  data-len={money(total).length > 13 ? "xl" : money(total).length > 11 ? "l" : "m"}
                  role="img"
                  aria-label={`${money(total)} em ${MONTHS[monthIndex]?.toLowerCase()}, ${Math.round(monthShare * 100)}% do ano`}
                >
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle className="donut-track" cx="60" cy="60" r="50" />
                    <circle
                      className="donut-value"
                      cx="60"
                      cy="60"
                      r="50"
                      strokeDasharray={RING}
                      strokeDashoffset={RING * (1 - monthShare)}
                    />
                  </svg>
                  <div className="donut-mid" aria-hidden="true">
                    <small>Total do mês</small>
                    <strong>
                      <Money value={total} />
                    </strong>
                    <em>{Math.round(monthShare * 100)}% do ano</em>
                  </div>
                </div>
              </div>
            </header>
            <div className="body">
              <div className="g3">
                <section className="card" aria-labelledby="hist-mes">
                  <div className="card-hd">
                    <h2 id="hist-mes">Histórico do mês</h2>
                    <span className="tag">
                      {MONTHS[monthIndex]} · {year}
                    </span>
                  </div>
                  <div className="fields fields-2">
                    <FieldSelect
                      label="Mês"
                      value={monthIndex}
                      onChange={(value) => setMonth(new Date(year, Number(value), 1))}
                      options={MONTHS.map((label, index) => ({ value: index, label }))}
                    />
                    <FieldSelect
                      label="Ano"
                      value={year}
                      onChange={(value) => setMonth(new Date(Number(value), monthIndex, 1))}
                      options={availableYears.map((y) => ({ value: y, label: String(y) }))}
                    />
                  </div>
                  <div className="res" aria-live="polite">
                    <span className="lab">Total do mês</span>
                    <strong className="val">
                      <Money value={total} />
                    </strong>
                    <span className="sub">
                      {plural(monthly.length, "procedimento")} em{" "}
                      {MONTHS[monthIndex]?.toLowerCase()}
                    </span>
                  </div>
                </section>

                <section className="card" aria-labelledby="hist-ano">
                  <div className="card-hd">
                    <h2 id="hist-ano">Histórico do ano</h2>
                    <span className="tag">{annualSpendingYear}</span>
                  </div>
                  <div className="fields">
                    <FieldSelect
                      label="Ano"
                      value={annualSpendingYear}
                      onChange={(value) => setAnnualSpendingYear(Number(value))}
                      options={availableYears.map((y) => ({ value: y, label: String(y) }))}
                    />
                  </div>
                  <div className="res res-two" aria-live="polite">
                    <div>
                      <span className="lab">Total no ano</span>
                      <strong className="val">
                        <Money value={annualTotal} />
                      </strong>
                      <span className="sub">
                        {plural(annualEntries.length, "procedimento")} em {annualSpendingYear}
                      </span>
                    </div>
                    <div>
                      <span className="lab">Média por visita</span>
                      <strong className="val">
                        <Money
                          value={annualEntries.length ? annualTotal / annualEntries.length : 0}
                        />
                      </strong>
                      <span className="sub">média em {annualSpendingYear}</span>
                    </div>
                  </div>
                </section>

                <section className="card" aria-labelledby="hist-gastos">
                  <div className="card-hd">
                    <h2 id="hist-gastos">Histórico de gastos</h2>
                    <span className="tag">
                      {MONTHS[historyMonth]} · {historyYear}
                    </span>
                  </div>
                  <div className="fields fields-3">
                    <FieldSelect
                      label="Categoria"
                      value={spendingCategory}
                      onChange={setSpendingCategory}
                      options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
                    />
                    <FieldSelect
                      label="Mês"
                      value={historyMonth}
                      onChange={(value) => setHistoryMonth(Number(value))}
                      options={MONTHS.map((label, index) => ({ value: index, label }))}
                    />
                    <FieldSelect
                      label="Ano"
                      value={historyYear}
                      onChange={(value) => setHistoryYear(Number(value))}
                      options={availableYears.map((y) => ({ value: y, label: String(y) }))}
                    />
                  </div>
                  <div className="res res-dark" aria-live="polite">
                    <span className="lab">Total gasto com {spendingCategory}</span>
                    <strong className="val">
                      <Money value={selectedCategoryTotal} />
                    </strong>
                    <span className="sub">
                      {plural(selectedCategoryEntries.length, "procedimento")} em{" "}
                      {MONTHS[historyMonth]?.toLowerCase()} de {historyYear}
                    </span>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {view === "novo" && (
          <>
            <header className="hd">
              <div className="topbar topbar-form">
                <button
                  className="ib ib-rose"
                  aria-label="Voltar"
                  onClick={() => navigate(editingEntry ? "procedimentos" : "painel")}
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                  className="ib"
                  aria-label="Ir para o Painel"
                  onClick={() => navigate("painel")}
                >
                  <Home size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="hd-in">
                <h1 ref={heading} tabIndex={-1}>
                  {editingEntry ? "Editar registro" : "Novo registro"}
                </h1>
                <p>
                  {editingEntry
                    ? "Atualize os detalhes deste momento de cuidado."
                    : "Guarde os detalhes do seu momento de cuidado."}
                </p>
                <div className="ba-slot" ref={setPhotoSlot} />
              </div>
            </header>
            <div className="body">
              <NewEntry
                key={editingEntry?.id ?? `${draftCategory}-${draftProcedure}`}
                date={dateKey(new Date())}
                time="00:00"
                initialCategory={draftCategory}
                initialProcedure={draftProcedure}
                initialEntry={editingEntry}
                disabled={!loaded}
                photoSlot={photoSlot}
                onCancel={() => navigate(editingEntry ? "procedimentos" : "painel")}
                onSave={save}
              />
            </div>
          </>
        )}

        {view === "config" && (
          <>
            <header className="hd">
              {topbar}
              <div className="hd-in">
                <h1 ref={heading} tabIndex={-1}>
                  Configurações
                </h1>
                <p>Atualize sua foto, nome e cidade.</p>
              </div>
            </header>
            <div className="body">
              {profile ? (
                <SettingsForm
                  key={`${profile.nome}|${profile.cidade}|${profile.foto_path ?? ""}`}
                  profile={profile}
                  onSave={saveProfile}
                  onCancel={() => navigate("painel")}
                />
              ) : (
                <p className="empty card" role="status">
                  Carregando seu perfil…
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {view !== "novo" && (
        <nav className="tabbar" aria-label="Menu principal">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {notice && (
        <div className="toast" role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <DeleteEntryDialog
        entry={entries.find((entry) => entry.id === deletion.pending)}
        deletion={deletion}
      />
    </div>
  );
}

/* Barra superior do mobile: perfil, Painel e opções. Oculta no desktop. */
function Topbar({
  view,
  profile,
  userEmail,
  onNavigate,
  onNew,
  onSignOut,
}: {
  view: View;
  profile: Profile | null;
  userEmail: string;
  onNavigate: (view: View) => void;
  onNew: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="topbar">
      <div className="me">
        <Avatar profile={profile} size={46} className="me-photo" />
        <div>
          {profile?.cidade && (
            <span>
              <MapPin size={12} aria-hidden="true" /> {profile.cidade}
            </span>
          )}
          <b>{profile?.nome}</b>
        </div>
      </div>
      <div className="topbar-actions" ref={root}>
        <button
          className="ib"
          aria-label="Ir para o Painel"
          aria-current={view === "painel" ? "page" : undefined}
          onClick={() => onNavigate("painel")}
        >
          <Home size={20} aria-hidden="true" />
        </button>
        <button
          className="ib"
          aria-label="Opções do perfil"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <MoreVertical size={20} aria-hidden="true" />
        </button>
        {open && (
          <div className="popover">
            <b>
              {profile?.nome}
              {profile?.cidade ? ` · ${profile.cidade}` : ""}
            </b>
            <small>{userEmail}</small>
            <button
              onClick={() => {
                setOpen(false);
                onNew();
              }}
            >
              <Plus size={16} aria-hidden="true" /> Novo registro
            </button>
            <button
              aria-current={view === "config" ? "page" : undefined}
              onClick={() => {
                setOpen(false);
                onNavigate("config");
              }}
            >
              <Settings size={16} aria-hidden="true" /> Configurações
            </button>
            <button className="danger" onClick={onSignOut}>
              <LogOut size={16} aria-hidden="true" /> Sair do diário
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type Option = { value: string | number; label: string };

function PillSelect({
  label,
  value,
  options,
  onChange,
  accent = false,
}: {
  label: string;
  value: string | number;
  options: Option[];
  onChange: (value: string) => void;
  accent?: boolean;
}) {
  return (
    <label className={`pill-select ${accent ? "accent" : ""}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-select">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Procedimentos                                                       */
/* ------------------------------------------------------------------ */

type Deletion = {
  pending: string | null;
  setPending: (id: string | null) => void;
  remove: (id: string) => Promise<void>;
};

function DeleteEntryDialog({ entry, deletion }: { entry: Entry | undefined; deletion: Deletion }) {
  return (
    <AlertDialog.Root
      open={Boolean(entry)}
      onOpenChange={(open) => !open && deletion.setPending(null)}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay" />
        <AlertDialog.Content className="modal">
          <span className="modal-ic danger" aria-hidden="true">
            <Trash2 size={22} />
          </span>
          <AlertDialog.Title>Excluir este registro?</AlertDialog.Title>
          <AlertDialog.Description>
            Esta ação é permanente e não poderá ser desfeita.
          </AlertDialog.Description>
          {entry && (
            <SummaryCard
              title={entry.procedimento}
              subtitle={entry.categoria}
              value={entry.valor}
              meta={
                <span>
                  <CalendarIcon size={14} aria-hidden="true" /> {prettyDate(entry.data)}
                </span>
              }
            />
          )}
          <div className="modal-actions">
            <AlertDialog.Cancel className="btn-ghost">Cancelar</AlertDialog.Cancel>
            <AlertDialog.Action
              className="btn-danger"
              onClick={() => entry && void deletion.remove(entry.id)}
            >
              <Trash2 size={17} aria-hidden="true" /> Excluir registro
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function SummaryCard({
  title,
  subtitle,
  value,
  meta,
}: {
  title: string;
  subtitle: string;
  value: number;
  meta: ReactNode;
}) {
  return (
    <div className="summary">
      <div className="summary-main">
        <span>
          <b>{title}</b>
          <small>{subtitle}</small>
        </span>
        <strong>
          <Money value={value} />
        </strong>
      </div>
      <div className="summary-meta">{meta}</div>
    </div>
  );
}

function ProceduresByMonth({
  items,
  deletion,
  loaded,
  onEdit,
}: {
  items: Entry[];
  deletion: Deletion;
  loaded: boolean;
  onEdit: (entry: Entry) => void;
}) {
  if (!loaded)
    return (
      <p className="empty" role="status">
        Carregando seus registros…
      </p>
    );
  if (!items.length)
    return (
      <div className="empty">
        <CalendarDays size={28} strokeWidth={1.4} aria-hidden="true" />
        <p>Nenhum procedimento encontrado.</p>
        <span>Adicione um registro ou ajuste a busca e os filtros.</span>
      </div>
    );

  const groups = items.reduce<Map<string, Entry[]>>((months, entry) => {
    const key = entry.data.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), entry]);
    return months;
  }, new Map());

  return (
    <>
      {Array.from(groups, ([key, monthEntries]) => {
        const [groupYear = 0, monthNumber = 1] = key.split("-").map(Number);
        return (
          <section key={key} aria-labelledby={`month-${key}`}>
            <div className="sec">
              <h2 id={`month-${key}`}>
                {MONTHS[monthNumber - 1]} {groupYear}
              </h2>
              <span>{plural(monthEntries.length, "procedimento")}</span>
            </div>
            <ul className="items">
              {monthEntries.map((entry) => (
                <EntryItem key={entry.id} entry={entry} deletion={deletion} onEdit={onEdit} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function EntryItem({
  entry,
  deletion,
  onEdit,
}: {
  entry: Entry;
  deletion: Deletion;
  onEdit: (entry: Entry) => void;
}) {
  const monthLabel = MONTHS[Number(entry.data.slice(5, 7)) - 1]?.slice(0, 3);
  return (
    <li className="item">
      <div className="item-body">
        <span className="date">
          <b>{entry.data.slice(8, 10)}</b>
          <small>{monthLabel}</small>
        </span>
        <div className="info">
          <b>{entry.procedimento}</b>
          <span className="meta">
            <CategoryIcon category={entry.categoria} size={14} />
            {entry.categoria}
          </span>
          {entry.local && (
            <span className="meta">
              <MapPin size={14} strokeWidth={1.8} aria-hidden="true" />
              {entry.local}
            </span>
          )}
          {entry.notas && (
            <span className="meta meta-notes">
              <NotebookPen size={14} strokeWidth={1.8} aria-hidden="true" />
              <span>{entry.notas}</span>
            </span>
          )}
        </div>
      </div>
      <div className="item-tools">
        <button
          className="tb"
          aria-label={`Editar ${entry.procedimento}`}
          title="Editar"
          onClick={() => onEdit(entry)}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
        <button
          className="tb"
          aria-label={`Excluir ${entry.procedimento}`}
          title="Excluir"
          onClick={() => deletion.setPending(entry.id)}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="item-foot">
        {(entry.antesUrl || entry.depoisUrl || entry.evidenciaUrl) && (
          <div className="ba-thumbs">
            {entry.antesUrl && (
              <figure>
                <figcaption>Antes</figcaption>
                <PhotoThumb
                  src={entry.antesUrl}
                  label={`Antes: ${entry.procedimento}`}
                  className="ba-thumb"
                />
              </figure>
            )}
            {entry.depoisUrl && (
              <figure>
                <figcaption>Depois</figcaption>
                <PhotoThumb
                  src={entry.depoisUrl}
                  label={`Depois: ${entry.procedimento}`}
                  className="ba-thumb"
                />
              </figure>
            )}
            {entry.evidenciaUrl && (
              <figure>
                <figcaption>Evidências</figcaption>
                <PhotoThumb
                  src={entry.evidenciaUrl}
                  label={`Evidência de ${entry.procedimento}`}
                  className="ba-thumb"
                />
              </figure>
            )}
          </div>
        )}
        <div className="item-price">
          <span>Valor</span>
          <strong>
            <Money value={entry.valor} />
          </strong>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Novo registro                                                       */
/* ------------------------------------------------------------------ */

function NewEntry({
  date,
  time,
  initialCategory,
  initialProcedure,
  initialEntry,
  disabled,
  photoSlot,
  onSave,
  onCancel,
}: {
  date: string;
  time: string;
  disabled: boolean;
  photoSlot: HTMLElement | null;
  initialCategory: string;
  initialProcedure: string;
  initialEntry: Entry | null;
  onSave: (e: Entry, photos: EntryPhotos) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    procedimento: initialEntry?.procedimento ?? initialProcedure,
    categoria: initialEntry?.categoria ?? initialCategory,
    local: initialEntry?.local ?? "",
    data: initialEntry?.data ?? date,
    hora: initialEntry?.hora ?? time,
    valor: initialEntry ? String(initialEntry.valor).replace(".", ",") : "",
    notas: initialEntry?.notas ?? "",
  });
  const [error, setError] = useState("");
  const [pendingEntry, setPendingEntry] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const [evidence, setEvidence] = useState<File>();
  const [evidencePreview, setEvidencePreview] = useState(initialEntry?.evidenciaUrl ?? "");
  const [beforePhoto, setBeforePhoto] = useState<File>();
  const [beforePreview, setBeforePreview] = useState(initialEntry?.antesUrl ?? "");
  const [afterPhoto, setAfterPhoto] = useState<File>();
  const [afterPreview, setAfterPreview] = useState(initialEntry?.depoisUrl ?? "");
  const [photoError, setPhotoError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (evidencePreview.startsWith("blob:")) URL.revokeObjectURL(evidencePreview);
    },
    [evidencePreview],
  );
  useEffect(
    () => () => {
      if (beforePreview.startsWith("blob:")) URL.revokeObjectURL(beforePreview);
    },
    [beforePreview],
  );
  useEffect(
    () => () => {
      if (afterPreview.startsWith("blob:")) URL.revokeObjectURL(afterPreview);
    },
    [afterPreview],
  );

  /** Confere tipo e tamanho; devolve a mensagem de erro, ou "" se a foto serve. */
  function checkPhoto(file: File) {
    if (!PHOTO_TYPES.includes(file.type)) return "Use uma foto em JPG, PNG ou WebP.";
    if (file.size > MAX_EVIDENCE_BYTES) return "A foto deve ter no máximo 8 MB.";
    return "";
  }

  const set =
    (key: keyof typeof form) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((old) => ({ ...old, [key]: e.target.value }));

  const photoSection = (
    <section className="ba-head" aria-labelledby="ba-head-title">
      <p className="ba-head-title" id="ba-head-title">
        Guarde como ficou
      </p>
      <div className="ba-fields">
        <PhotoTile
          label="Antes"
          preview={beforePreview}
          onPick={(file) => {
            const problem = checkPhoto(file);
            setPhotoError(problem);
            if (problem) return;
            setBeforePhoto(file);
            setBeforePreview(URL.createObjectURL(file));
          }}
        />
        <PhotoTile
          label="Depois"
          accent
          preview={afterPreview}
          onPick={(file) => {
            const problem = checkPhoto(file);
            setPhotoError(problem);
            if (problem) return;
            setAfterPhoto(file);
            setAfterPreview(URL.createObjectURL(file));
          }}
        />
      </div>
      {photoError && (
        <p className="ba-error" role="alert">
          {photoError}
        </p>
      )}
    </section>
  );

  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        const raw = form.valor.trim();
        const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
        const value = Number(normalized);
        if (!form.procedimento.trim()) {
          setError("Informe o nome do procedimento.");
          return;
        }
        if (!raw || !Number.isFinite(value) || value < 0) {
          setError("Informe um valor válido, igual ou maior que zero.");
          return;
        }
        if (!form.categoria) {
          setError("Escolha uma categoria para o procedimento.");
          return;
        }
        setError("");
        setPendingEntry({
          ...form,
          procedimento: form.procedimento.trim(),
          id: initialEntry?.id ?? crypto.randomUUID(),
          valor: value,
        });
      }}
    >
      {photoSlot && createPortal(photoSection, photoSlot)}
      <div className="form-title">
        <span className="sq-ic" aria-hidden="true">
          <Heart size={20} strokeWidth={1.8} />
        </span>
        <div>
          <b>Detalhes do procedimento</b>
          <small>Preencha o essencial e salve</small>
        </div>
      </div>

      <div className="form-grid">
        <label className="fld span">
          <span className="fl">Procedimento</span>
          <input
            className="inp"
            autoFocus
            required
            maxLength={160}
            value={form.procedimento}
            onChange={set("procedimento")}
            placeholder="Ex.: Corte & Escova"
          />
        </label>
        <label className="fld">
          <span className="fl">Categoria</span>
          <span className="select-wrap">
            <select className="inp" value={form.categoria} onChange={set("categoria")} required>
              {CATEGORIAS.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </label>
        <label className="fld">
          <span className="fl">Valor (R$)</span>
          <span className="cur">
            <b aria-hidden="true">R$</b>
            <input
              className="inp"
              required
              inputMode="decimal"
              value={form.valor}
              onChange={set("valor")}
              placeholder="0,00"
            />
          </span>
        </label>
        <label className="fld span-m">
          <span className="fl">Data</span>
          <input className="inp" required type="date" value={form.data} onChange={set("data")} />
        </label>
        <label className="fld span-m">
          <span className="fl">
            Salão / Profissional <i>opcional</i>
          </span>
          <input
            className="inp"
            maxLength={160}
            value={form.local}
            onChange={set("local")}
            placeholder="Onde foi o seu cuidado?"
          />
        </label>
        <label className="fld span">
          <span className="fl">
            Anotações <i>opcional</i>
          </span>
          <textarea
            className="inp"
            rows={3}
            maxLength={2000}
            value={form.notas}
            onChange={set("notas")}
            placeholder="Produtos, cores ou algo para lembrar…"
          />
        </label>
        <div className="fld span">
          <span className="fl" id="evidencia-label">
            Evidências <i>opcional</i>
          </span>
          <button
            type="button"
            className="upload"
            aria-describedby="evidencia-hint"
            onClick={() => fileInput.current?.click()}
          >
            {evidencePreview ? (
              <img src={evidencePreview} alt="Prévia da evidência selecionada" />
            ) : (
              <span className="sq-ic" aria-hidden="true">
                <ImagePlus size={20} strokeWidth={1.8} />
              </span>
            )}
            {evidencePreview ? "Trocar foto" : "Adicionar foto"}
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            aria-labelledby="evidencia-label"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 8 * 1024 * 1024) {
                setError("A foto deve ter no máximo 8 MB.");
                event.target.value = "";
                return;
              }
              setEvidence(file);
              setEvidencePreview(URL.createObjectURL(file));
              setError("");
            }}
          />
          <small className="hint" id="evidencia-hint">
            JPG, PNG ou WebP até 8 MB.
          </small>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button disabled={disabled} className="cta" type="submit">
          <Check size={19} aria-hidden="true" />
          {initialEntry ? "Salvar alterações" : "Salvar registro"}
        </button>
        <button className="btn-text" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <AlertDialog.Root
        open={Boolean(pendingEntry)}
        onOpenChange={(open) => !open && setPendingEntry(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="overlay" />
          <AlertDialog.Content className="modal">
            <span className="modal-ic" aria-hidden="true">
              <Heart size={22} />
            </span>
            <AlertDialog.Title>
              {initialEntry ? "Salvar as alterações?" : "Salvar este registro?"}
            </AlertDialog.Title>
            <AlertDialog.Description>
              Revise as informações antes de salvar no seu diário.
            </AlertDialog.Description>
            {pendingEntry && (
              <SummaryCard
                title={pendingEntry.procedimento}
                subtitle={pendingEntry.categoria}
                value={pendingEntry.valor}
                meta={
                  <>
                    <span>
                      <CalendarIcon size={14} aria-hidden="true" /> {prettyDate(pendingEntry.data)}
                    </span>
                    {pendingEntry.local && (
                      <span>
                        <MapPin size={14} aria-hidden="true" /> {pendingEntry.local}
                      </span>
                    )}
                  </>
                }
              />
            )}
            <div className="modal-actions">
              <AlertDialog.Cancel className="btn-ghost">Continuar editando</AlertDialog.Cancel>
              <button
                className="btn-dark"
                type="button"
                disabled={saving}
                onClick={async () => {
                  if (!pendingEntry) return;
                  setSaving(true);
                  setError("");
                  try {
                    await onSave(pendingEntry, {
                      ...(evidence ? { evidencia: evidence } : {}),
                      ...(beforePhoto ? { antes: beforePhoto } : {}),
                      ...(afterPhoto ? { depois: afterPhoto } : {}),
                    });
                    setPendingEntry(null);
                  } catch {
                    setError(
                      "Não foi possível salvar o registro. Confira sua conexão e tente novamente.",
                    );
                    setPendingEntry(null);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                ) : (
                  <Check size={18} aria-hidden="true" />
                )}
                {saving ? "Salvando…" : initialEntry ? "Salvar alterações" : "Salvar registro"}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Configurações                                                       */
/* ------------------------------------------------------------------ */

function SettingsForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile;
  onSave: (values: { nome: string; cidade: string }, photo?: File) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(profile.nome);
  const [cidade, setCidade] = useState(profile.cidade);
  const [photo, setPhoto] = useState<File>();
  const [preview, setPreview] = useState(profile.fotoUrl ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <form
      className="card form-card settings-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const name = nome.trim();
        if (!name) {
          setError("Informe seu nome.");
          return;
        }
        setError("");
        setSaving(true);
        try {
          await onSave({ nome: name, cidade: cidade.trim() }, photo);
        } catch {
          setError(
            "Não foi possível salvar as configurações. Confira sua conexão e tente novamente.",
          );
          setSaving(false);
        }
      }}
    >
      <div className="form-title">
        <span className="sq-ic" aria-hidden="true">
          <Settings size={20} strokeWidth={1.8} />
        </span>
        <div>
          <b>Seu perfil</b>
          <small>Como você aparece no diário</small>
        </div>
      </div>

      <div className="avatar-edit">
        {preview ? (
          <img
            className="edit-photo"
            src={preview}
            alt="Sua foto de perfil"
            width="96"
            height="96"
          />
        ) : (
          <Avatar profile={profile} size={96} className="edit-photo" />
        )}
        <div>
          <button
            type="button"
            className="btn-soft"
            aria-describedby="foto-hint"
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus size={18} aria-hidden="true" /> Trocar foto
          </button>
          <small className="hint" id="foto-hint">
            JPG, PNG ou WebP até 5 MB.
          </small>
        </div>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="Escolher foto de perfil"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
              setError("Use uma foto em JPG, PNG ou WebP.");
              return;
            }
            if (file.size > MAX_PHOTO_BYTES) {
              setError("A foto deve ter no máximo 5 MB.");
              return;
            }
            setPhoto(file);
            setPreview(URL.createObjectURL(file));
            setError("");
          }}
        />
      </div>

      <div className="form-grid">
        <label className="fld span">
          <span className="fl">Nome</span>
          <input
            className="inp"
            required
            maxLength={80}
            autoComplete="name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Como você quer ser chamada?"
          />
        </label>
        <label className="fld span">
          <span className="fl">
            Cidade <i>opcional</i>
          </span>
          <input
            className="inp"
            maxLength={80}
            autoComplete="address-level2"
            value={cidade}
            onChange={(event) => setCidade(event.target.value)}
            placeholder="Ex.: Canoas, RS"
          />
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="cta" type="submit" disabled={saving}>
          {saving ? (
            <LoaderCircle className="spin" size={19} aria-hidden="true" />
          ) : (
            <Check size={19} aria-hidden="true" />
          )}
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
        <button className="btn-text" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
