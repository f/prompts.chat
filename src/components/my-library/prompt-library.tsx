"use client";

import { useDeferredValue, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Copy, Star, Search, Library, SunMoon, Download, Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customize, exportCsv, importLibrary, MAX_IMPORT_BYTES, mergeLibrary, safeSource, searchLibrary, type LibraryPrompt } from "@/lib/my-library";

const FAVORITES_KEY = "my-library-favorites-v1";
const IMPORTS_KEY = "my-library-imports-v1";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("my-library-storage", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("my-library-storage", callback); };
};
const emptySnapshot = () => "";
function useStored(key: string) {
  return useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, emptySnapshot);
}
function store(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("my-library-storage"));
}
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PromptLibrary({ initialPrompts }: { initialPrompts: LibraryPrompt[] }) {
  const t = useTranslations("myLibrary");
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [limit, setLimit] = useState(60);
  const [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const storedFavorites = useStored(FAVORITES_KEY);
  const storedImports = useStored(IMPORTS_KEY);
  const favorites = useMemo(() => {
    try { const data: unknown = JSON.parse(storedFavorites || "[]"); return new Set<string>(Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : []); }
    catch { return new Set<string>(); }
  }, [storedFavorites]);
  const imported = useMemo(() => {
    try { return { prompts: importLibrary(storedImports || "[]", "json"), error: false }; }
    catch { return { prompts: [], error: true }; }
  }, [storedImports]);
  const prompts = useMemo(() => mergeLibrary(initialPrompts, imported.prompts), [initialPrompts, imported]);
  const categories = useMemo(() => [...new Set(prompts.map(p => p.category))].sort(), [prompts]);
  const filtered = useMemo(() => searchLibrary(prompts, deferredQuery, category, subcategory).filter(p => !favoritesOnly || favorites.has(p.id)), [prompts, deferredQuery, category, subcategory, favoritesOnly, favorites]);
  const selected = filtered.find(p => p.id === selectedId) ?? filtered[0];
  function chooseCategory(value: string, child = "") { setCategory(value); setSubcategory(child); setLimit(60); }
  function toggleFavorite(id: string) {
    const next = new Set(favorites); if (next.has(id)) next.delete(id); else next.add(id);
    try { store(FAVORITES_KEY, [...next]); setStatus(""); } catch { setStatus(t("storageError")); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (imported.error) throw new Error("Corrupt saved imports");
      if (file.size > MAX_IMPORT_BYTES || !/\.(json|csv)$/i.test(file.name)) throw new Error("Unsupported import");
      const incoming = importLibrary(await file.text(), /\.csv$/i.test(file.name) ? "csv" : "json");
      const all = mergeLibrary(prompts, incoming);
      const repositoryIds = new Set(initialPrompts.map(p => p.id));
      const next = mergeLibrary(imported.prompts, incoming.filter(p => !repositoryIds.has(p.id)));
      // Validate the total size before changing storage; failed imports are atomic.
      if (new Blob([JSON.stringify(next)]).size > MAX_IMPORT_BYTES) throw new Error("Storage limit");
      store(IMPORTS_KEY, next);
      setStatus(t("imported", { count: all.length - prompts.length }));
    } catch { setStatus(t("importError")); }
    if (fileInput.current) fileInput.current.value = "";
  }
  const directory = <nav aria-label={t("directory")} className="space-y-3">
    <Button variant={!category && !favoritesOnly ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => { chooseCategory(""); setFavoritesOnly(false); }}><Library className="mr-2 size-4" />{t("all")}</Button>
    <Button variant={favoritesOnly ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => { setFavoritesOnly(!favoritesOnly); setLimit(60); }}><Star className="mr-2 size-4" />{t("favorites")} ({favorites.size})</Button>
    {categories.map(name => <details key={name} className="rounded-md border p-2" open={category === name || undefined}>
      <summary className="cursor-pointer text-sm font-medium">{name} <span className="text-muted-foreground">({prompts.filter(p => p.category === name).length})</span></summary>
      <Button variant="ghost" className="mt-1 w-full justify-start" aria-pressed={category === name && !subcategory} onClick={() => chooseCategory(name)}>{t("allInCategory", { category: name })}</Button>
      {[...new Set(prompts.filter(p => p.category === name).map(p => p.subcategory).filter(Boolean))].sort().map(child => <Button key={child} variant="ghost" size="sm" className="w-full justify-start pl-6" aria-pressed={category === name && subcategory === child} onClick={() => chooseCategory(name, child)}>{child}</Button>)}
    </details>)}
  </nav>;
  return <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{t("eyebrow")}</p><h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="icon" aria-label={t("theme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><SunMoon className="size-4" /></Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}><Upload className="mr-2 size-4" />{t("import")}</Button>
        <input ref={fileInput} type="file" accept=".json,.csv" aria-label={t("import")} className="sr-only" onChange={e => void importFile(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => download(JSON.stringify(prompts), "prompt-directory.json", "application/json")}><Download className="mr-2 size-4" />{t("exportJson")}</Button>
        <Button variant="outline" asChild><a href="/my-library/export?format=html" download="prompt-selector.html">{t("exportHtml")}</a></Button>
        <Button variant="outline" onClick={() => download(exportCsv(prompts), "prompt-directory.csv", "text/csv;charset=utf-8")}>{t("exportCsv")}</Button>
      </div>
    </header>
    <div className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground" /><Input className="h-11 ps-10" type="search" aria-label={t("search")} placeholder={t("search")} value={query} onChange={e => { setQuery(e.target.value); setLimit(60); }} /></div>
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">{t("category")} <select className="rounded-md border bg-background p-2" value={category} onChange={e => chooseCategory(e.target.value)}><option value="">{t("all")}</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="text-sm">{t("subcategory")} <select className="rounded-md border bg-background p-2" value={subcategory} onChange={e => { setSubcategory(e.target.value); setLimit(60); }}><option value="">{t("all")}</option>{[...new Set(prompts.filter(p => !category || p.category === category).map(p => p.subcategory).filter(Boolean))].sort().map(c => <option key={c}>{c}</option>)}</select></label>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{status || t("results", { count: filtered.length })}</p>
    {imported.error && <p role="alert">{t("storedImportError")}</p>}
    <details className="rounded-lg border p-3 md:hidden"><summary className="cursor-pointer font-medium">{t("directory")}</summary><div className="mt-3">{directory}</div></details>
    <div className="grid items-start gap-5 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="hidden md:block">{directory}</aside>
      <section aria-label={t("prompts")} className="space-y-3">
        {!filtered.length && <p className="rounded-xl border border-dashed p-8 text-muted-foreground">{t("empty")}</p>}
        {filtered.slice(0, limit).map(p => <article key={p.id} className={`rounded-xl border p-4 transition-colors ${selected?.id === p.id ? "border-primary bg-primary/5" : "bg-card hover:border-primary/50"}`}>
          <div className="flex items-start gap-2"><button className="min-w-0 flex-1 text-start focus-visible:outline-2 focus-visible:outline-primary" aria-pressed={selected?.id === p.id} onClick={() => { setSelectedId(p.id); if (window.innerWidth < 1280) requestAnimationFrame(() => document.getElementById("library-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}><span className="block text-xs text-muted-foreground">{p.category} {p.subcategory && ` / ${p.subcategory}`}</span><span className="mt-1 block font-semibold">{p.title}</span><span className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description || p.prompt}</span></button>
            <Button size="icon" variant="ghost" aria-label={t("favorite", { title: p.title })} aria-pressed={favorites.has(p.id)} onClick={() => toggleFavorite(p.id)}><Star className={`size-4 ${favorites.has(p.id) ? "fill-current text-primary" : ""}`} /></Button></div>
        </article>)}
        {filtered.length > limit && <Button variant="outline" className="w-full" onClick={() => setLimit(limit + 60)}>{t("more")}</Button>}
      </section>
      <section id="library-preview" aria-label={t("preview")} className="min-w-0 rounded-xl border bg-card p-5 md:col-start-2 xl:col-start-auto xl:sticky xl:top-5">
        {selected ? <PromptPreview key={selected.id} prompt={selected} favorite={favorites.has(selected.id)} onFavorite={() => toggleFavorite(selected.id)} /> : <p className="text-muted-foreground">{t("choose")}</p>}
      </section>
    </div>
    <p className="text-xs text-muted-foreground">{t("localNotice")}</p>
  </div>;
}

function PromptPreview({ prompt, favorite, onFavorite }: { prompt: LibraryPrompt; favorite: boolean; onFavorite: () => void }) {
  const t = useTranslations("myLibrary");
  const [values, setValues] = useState<Record<string, string>>({});
  const [copyStatus, setCopyStatus] = useState("");
  const finalPrompt = customize(prompt.prompt, values);
  async function copy() {
    try { await navigator.clipboard.writeText(finalPrompt); setCopyStatus(t("copied")); }
    catch { setCopyStatus(t("copyError")); }
  }
  return <div className="space-y-4">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("preview")}</p>
    <h2 className="text-xl font-semibold">{prompt.title}</h2>
    {prompt.description && <p className="text-sm text-muted-foreground">{prompt.description}</p>}
    <div className="flex flex-wrap gap-2">{prompt.tags.map(tag => <span key={tag} className="rounded bg-muted px-2 py-1 text-xs">{tag}</span>)}</div>
    {prompt.variables.length > 0 && <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">{t("customize")}</legend>{prompt.variables.map((name, i) => <label key={name} htmlFor={`variable-${i}`} className="block text-sm">{name}<Input id={`variable-${i}`} className="mt-1" value={Object.hasOwn(values, name) ? values[name] : ""} onChange={e => { setValues({ ...values, [name]: e.target.value }); setCopyStatus(""); }} /></label>)}</fieldset>}
    <label className="block text-sm font-medium" htmlFor="final-prompt">{t("finalPrompt")}</label>
    <textarea id="final-prompt" readOnly value={finalPrompt} className="min-h-72 w-full resize-y rounded-md border bg-muted/40 p-3 font-mono text-sm leading-relaxed" />
    <div className="flex flex-wrap gap-2"><Button onClick={() => void copy()}><Copy className="mr-2 size-4" />{t("copy")}</Button><Button variant="outline" aria-pressed={favorite} onClick={onFavorite}><Star className={`mr-2 size-4 ${favorite ? "fill-current" : ""}`} />{t("favorites")}</Button></div>
    <p role="status" className="text-sm">{copyStatus}</p>
    {safeSource(prompt.source) && <a className="inline-flex items-center gap-1 text-sm underline" href={safeSource(prompt.source)} target="_blank" rel="noopener noreferrer">{t("source")}<ExternalLink className="size-3" /></a>}
    <p className="text-xs text-muted-foreground">{t("version", { version: prompt.version })}</p>
    <details className="text-sm"><summary className="cursor-pointer">{t("original")}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{prompt.prompt}</pre></details>
  </div>;
}
