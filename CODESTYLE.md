# Codestyle TuzovOS

Принципы, по которым пишем и ревьюим код. Не замена ESLint/TS-
конфигам, а культурный слой поверх них: какие паттерны считаем
багами, а какие — здоровым кодом.

Документ намеренно короткий. Каждое правило связано с реальным
кейсом из истории проекта — это его обоснование, не «потому что
красивее».

---

## 1. Parse, don't fall back

**Правило.** На границе системы (user input, файлы, сеть) парсим
строго: Zod / regex / собственный strict-helper. Ошибка валидации →
видимое сообщение пользователю или throw. Внутри (после валидации) —
доверяем типам, не пишем «защитные» `if`'ы для невозможных случаев.

**Антипаттерн:**

```ts
const dur = parseInt(input, 10) || 60; // "abc" → 60, тихо
const min = timeToMinutes(input);      // вернёт 0 на мусоре, тихо
```

**Хороший вариант:**

```ts
const min = parseHHMMStrict(input);
if (min == null) {
  toast.error("Время в формате HH:MM");
  return;
}
```

**Почему.** Silent fallback на `0`/дефолт превращает баг в визуально
валидное состояние, которое потом сложно отлаживать (блок «вроде»
сохранился, но в 00:00). Лучше явный сбой, чем тихая ошибка.

**Ссылки.** [Parse, don't validate — Alexis King](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).

---

## 2. Discriminated unions для состояний с несколькими вариантами

**Правило.** Если у одного state есть несколько вариантов — это
discriminated union с тегом (`kind`/`mode`/`type`), а не nullable
объект с optional-полями. Это даёт exhaustive matching, чистое
narrowing и убирает `!`.

**Антипаттерн:**

```ts
type Editor =
  | null
  | { mode: "new" | "edit"; block?: Block; prefill?: Prefill };
// потом: if (editor.mode === "edit" && editor.block) ...
```

**Хороший вариант:**

```ts
type Editor =
  | null
  | { kind: "new"; defaults: Prefill }
  | { kind: "edit"; block: Block };
// switch (editor.kind) { case "edit": editor.block.id /* OK */ }
```

**Почему.** Optional-поля внутри union — footgun: TS не может
доказать, что в edit-режиме `block` присутствует, и приходится писать
`&& block` или `block!`. Discriminated union сужает тип сам.

**Ссылки.** [TS Handbook — Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions),
[Total TypeScript — Discriminated Unions](https://www.totaltypescript.com/discriminated-unions-are-a-devs-best-friend).

---

## 3. Не использовать `!` (non-null assertion)

**Правило.** `!` — сигнал, что narrowing неверный или структура
state'а спроектирована неправильно. Заменять на early return,
discriminated union или вынос в `const` с явной проверкой.

**Антипаттерн:**

```tsx
{ctx && findBlock(ctx.blockId) && (
  <Menu block={findBlock(ctx.blockId)!} />  // ! здесь — врёт TS
)}
```

**Хороший вариант:**

```tsx
const ctxBlock = ctx ? findBlock(ctx.blockId) ?? null : null;
{ctx && ctxBlock && <Menu block={ctxBlock} />}
```

**Почему.** `!` отключает один из самых ценных инструментов TS —
поиск null-багов. Если без него не получается — пересмотри структуру
state'а (см. п. 2).

**Ссылки.** [`@typescript-eslint/no-non-null-assertion`](https://typescript-eslint.io/rules/no-non-null-assertion/).

---

## 4. `Record<UnionType, T>` для exhaustiveness

**Правило.** Если ключи известны как union — типизируй `Record`
именно этим union'ом, не `string`. Тогда добавление нового члена
union ломает компиляцию там, где забыли обновить map.

**Антипаттерн:**

```ts
type SaveStatus = "idle" | "saving" | "saved" | "error";
const COLOR: Record<string, string> = {
  idle: "...", saving: "...", saved: "...", error: "...",
}; // добавим "conflict" в SaveStatus — здесь молчит
```

**Хороший вариант:**

```ts
const COLOR: Record<SaveStatus, string> = { ... };
// добавим "conflict" → TS error "Property 'conflict' is missing"
```

**Почему.** Exhaustive map — единственное место, где TS может «найти
все callsites» при расширении union. Не теряй эту проверку.

---

## 5. Async UI actions: `await` + `try/catch`; success-toast — после await

**Правило.** Любая мутация store или I/O в обработчике UI:
- `await` результата;
- `try/catch` вокруг;
- `toast.success(...)` — **после** успешного `await`;
- `toast.error(...)` — в `catch`.

**Антипаттерн:**

```ts
void store.deleteBlock(id);
toast.success("Удалён"); // показано до фактической записи
```

**Хороший вариант:**

```ts
try {
  await store.deleteBlock(id);
  toast.success("Удалён");
} catch (e) {
  toast.error(`Не удалось: ${(e as Error).message}`);
}
```

**Почему.** Fire-and-forget с тостом до save врёт пользователю, если
запись падает (диск полный, нет прав, гонка). Status bar потом
покажет ошибку — а в логах действия «успешные».

**Ссылки.** [`@typescript-eslint/no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises/).

---

## 6. `useEffect` — для side effects, не для derivation

**Правило.** Если значение можно вывести из props/state — пиши его
inline или через `useMemo`, не через `useEffect + setState`.
`useEffect` — только для синхронизации с внешним миром: subscriptions,
DOM-listeners, fetch, window/document.

**Антипаттерн:**

```ts
const [total, setTotal] = useState(0);
useEffect(() => setTotal(items.reduce(...)), [items]); // лишний цикл
```

**Хороший вариант:**

```ts
const total = useMemo(() => items.reduce(...), [items]);
// или просто: const total = items.reduce(...);
```

**Почему.** `useEffect` — это «React, я не могу сделать это в
рендере». Если можешь — делай в рендере. Лишний эффект — лишний
ре-рендер и лишний источник ошибок в массиве зависимостей.

**Ссылки.** [react.dev — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

---

## 7. Хоткеи: три обязательных guard'а

**Правило.** Любой `window`/`document` `keydown` в фиче с UI-state
проверяет три вещи:

1. **Target — input?** `instanceof HTMLInputElement |
   HTMLTextAreaElement` или `target.isContentEditable` → `return` (не
   перехватываем пользовательский ввод).
2. **Открыт overlay?** Если есть модалка / ctx-меню / inline-инпут →
   `return` (кроме `Escape` для закрытия).
3. **Letter-shortcut и модификаторы.** `D`/`S`/`N` срабатывают только
   при `!metaKey && !ctrlKey && !altKey`. Иначе `Cmd+D` тоже сработает
   как `D`.

Для letters в i18n-чувствительных приложениях — `e.code` (`KeyN`), не
`e.key`. Не-letters (`Enter`, `Escape`, `Delete`, стрелки) — `e.key`,
они layout-стабильны.

**Антипаттерн:**

```ts
if (e.key === "d") setStatus("done");
// сработает на Cmd+D, на фокусе в кнопке открытой модалки,
// и не сработает на не-латинской раскладке
```

**Хороший вариант:**

```ts
if (isInputTarget(t)) return;
if (overlayOpen) {
  if (e.key === "Escape") closeAll();
  return;
}
const noMod = !e.metaKey && !e.ctrlKey && !e.altKey;
if (noMod && e.code === "KeyD") setStatus("done");
```

**Почему.** Без guard'ов хоткеи перехватывают ввод в инпутах,
дублируют системные шорткаты (`Cmd+S`, `Cmd+D`) и не работают на
не-латинских раскладках.

**Ссылки.** [MDN — KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code).

---

## 8. Outside-click — через ref + `contains`, не через CSS-селекторы

**Правило.** Каждый overlay (popup, ctx-меню, dropdown) сам управляет
своим close-listener'ом через `ref.current.contains(e.target)`.
Централизованный listener с захардкоженным `target.closest(".my-
popup")` хрупкий.

**Антипаттерн:**

```ts
document.addEventListener("mousedown", (e) => {
  if (e.target.closest(".popup")) return;
  closePopup();
}); // переименуем .popup → .pop, всё молча сломается
```

**Хороший вариант:**

```tsx
function Popup({ onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return <div ref={ref}>...</div>;
}
```

**Почему.** Компонент владеет жизненным циклом и DOM-ref'ом — он же
отвечает за close-логику. Это локальная инкапсуляция: переименование
класса не ломает чужой listener, а добавление нового overlay не
требует править центральный список селекторов.

---

## 9. `setTimeout(fn, N)` как ответ на blur/focus race — антипаттерн

**Правило.** Если хочется поставить `setTimeout(..., 100)`, чтобы
«дать событию завершиться» — переосмысли через `e.relatedTarget` или
явный outside-click handler. Магические задержки прячут гонки, а не
устраняют их.

**Антипаттерн:**

```tsx
<input onBlur={() => setTimeout(onCancel, 100)} />
// если кликнуть в новый input быстро — таймер убьёт второй
```

**Хороший вариант:**

```tsx
<input onBlur={(e) => {
  if (!e.relatedTarget?.closest(".my-popup")) onCancel();
}} />
// или вообще убрать onBlur и положиться на document mousedown
```

**Почему.** `setTimeout` создаёт окно, в котором два независимых
события могут пересечься. Чем длиннее таймер — тем больше окно. Это
всегда приводит к race-багам, которые воспроизводятся «иногда».

---

## 10. Modal/popup a11y baseline + live regions

**Правило.** Любая собственная модалка:

- `role="dialog" aria-modal="true" aria-labelledby={titleId}`;
- focus-trap (Tab cycles внутри модалки);
- restore-focus на close (запомнить `document.activeElement` при open,
  вернуть на close);
- Esc closes (явный listener).

Любой динамический статус для пользователя:

- `role="status" aria-live="polite"` для не-срочного (сохранение,
  success-toast);
- `role="alert" aria-live="assertive"` для ошибок и важного.

Кастомные «div-кнопки» (там, где `<button>` не подходит из-за layout):
`role="button"`, `tabIndex={0}`, Enter/Space → click, `aria-pressed` /
`aria-checked` если есть selected/checked состояние.

**Почему.** Без этого минимума приложение недоступно для keyboard-
only пользователей и screen-reader'ов. Это не «приятная фича», это
функциональная корректность.

**Ссылки.** [WAI-ARIA Authoring Practices — Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
[MDN — Live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions).

---

## 11. Цветная `border-left`-полоска на блоках/карточках — антипаттерн

**Правило.** Не добавляем толстую цветную полосу слева на time-блоках,
karbocards, pool-items, list-rows и аналогичных elementах в качестве
индикатора категории/статуса. Категория передаётся точкой, фоновым
тинтом или иконкой — не вертикальной чертой.

**Антипаттерн:**

```css
.block{ border-left: 3px solid; }
.block.cat-work{ border-left-color: var(--work) }
.block.cat-people{ border-left-color: var(--people) }
```

**Хороший вариант (точка / тинт):**

```css
.block{ background: var(--cat-bg-tint) }
.block .cat-dot{ width:8px; height:8px; border-radius:50%; background:var(--cat-color) }
```

**Почему.** Полоска на левом краю «прибивает» блок к левой границе
ячейки (см. screenshot phase-1 group-D), путает с реальными
рамками/разделителями колонок, плохо ведёт себя на узких ячейках
и при resize, дублирует функцию категорного фона/точки. Spec/mock
v2 наследовали её из early-mock, но этот вариант — анти-паттерн
поверх него.

**Что делать с уже существующим кодом.** Не выпиливать молча без
апрува — спека и mock пока требуют этот стиль. Перед удалением:
обновить spec.md / mock и согласовать с владельцем.

---

## Что НЕ в этом гайде (намеренно)

- **Конкретные библиотеки.** «Используй date-fns», «не самописный
  парсер ISO-недель» — это про текущий техдолг, не про культуру.
  Решения — в `docs/tasks/*.md` или TODO в коде.
- **Tauri/WebView-специфичное.** `onContextMenu={preventDefault}` на
  корне — комментарий в `Shell.tsx`, не правило.
- **Naming, форматирование, импорты.** Это территория ESLint /
  Prettier / TS-config — не нужно дублировать словами.
- **Default-значения «не magic numbers»**, размер компонентов и
  прочая базовая гигиена — общеизвестно, перегружать гайд не стоит.

---

## Как пользоваться

- При написании кода — держим в голове, особенно пункты 1, 5 и 7:
  большинство багов ловится здесь.
- В ревью — ссылаемся на пункт номером: «п.5 — toast до await».
- Если правило мешает в редком кейсе — обсуждаем, не молча
  игнорируем. Документ живой; нашёл новый системный паттерн —
  добавляй.
