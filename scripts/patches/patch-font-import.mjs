// 字号档位扩展 + 本地字体导入（IndexedDB 持久化）。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');
let n = 0;
function swap(a, b, label) {
  if (!t.includes(a)) {
    console.error('MISS:', label, '\n' + a.slice(0, 180));
    process.exit(1);
  }
  t = t.replace(a, () => b);
  n += 1;
  console.log('patched:', label);
}

// ① 字号档位 + 字体库 helper
swap(
  `    const SIZE_CHOICES = [12, 13, 14, 15, 16, 18];`,
  `    const SIZE_CHOICES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

    /** 本地字体存 IndexedDB（localStorage 装不下字体文件）。 */
    const FontStore = {
      open() {
        return new Promise((resolve, reject) => {
          if (!window.indexedDB) return reject(new Error('no indexedDB'));
          const req = window.indexedDB.open('feishu-panel-fonts', 1);
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('fonts')) req.result.createObjectStore('fonts');
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      },
      async put(name, buffer) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fonts', 'readwrite');
          tx.objectStore('fonts').put(buffer, name);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },
      async all() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fonts', 'readonly');
          const store = tx.objectStore('fonts');
          const keys = store.getAllKeys();
          const vals = store.getAll();
          tx.oncomplete = () => resolve((keys.result || []).map((k, i) => ({ name: String(k), buffer: vals.result[i] })));
          tx.onerror = () => reject(tx.error);
        });
      },
      async remove(name) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fonts', 'readwrite');
          tx.objectStore('fonts').delete(name);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },
    };

    async function registerFontFace(name, buffer) {
      const face = new window.FontFace(name, buffer);
      await face.load();
      window.document.fonts.add(face);
      return face;
    }`,
  'size choices + font store'
);

// ② 面板：字体网格里加自定义字体 + 导入按钮
swap(
  `              h('div', { className: 'fs-type-label' }, '字体'),
              h(
                'div',
                { className: 'fs-type-grid' },
                FONT_CHOICES.map((choice) =>
                  h(
                    'button',
                    {
                      key: choice.id,
                      type: 'button',
                      className: 'fs-type-opt',
                      'data-active': typeSet.font === choice.id,
                      style: { fontFamily: choice.stack },
                      onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, font: choice.id }),
                    },
                    choice.label
                  )
                )
              ),`,
  `              h('div', { className: 'fs-type-label' }, '字体'),
              h(
                'div',
                { className: 'fs-type-grid' },
                FONT_CHOICES.map((choice) =>
                  h(
                    'button',
                    {
                      key: choice.id,
                      type: 'button',
                      className: 'fs-type-opt',
                      'data-active': typeSet.font === choice.id,
                      style: { fontFamily: choice.stack },
                      onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, font: choice.id }),
                    },
                    choice.label
                  )
                ),
                (props.customFonts || []).map((name) =>
                  h(
                    'div',
                    { key: 'c-' + name, className: 'fs-type-custom' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'fs-type-opt',
                        'data-active': typeSet.font === name,
                        title: name,
                        style: { fontFamily: '"' + name + '", system-ui, sans-serif' },
                        onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, font: name }),
                      },
                      name.length > 6 ? name.slice(0, 6) + '…' : name
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'fs-type-del',
                        title: '移除这个字体',
                        onClick: () => props.onRemoveFont && props.onRemoveFont(name),
                      },
                      '×'
                    )
                  )
                ),
                h(
                  'label',
                  { className: 'fs-type-opt fs-type-import', title: '导入本地字体（ttf / otf / woff / woff2）' },
                  '＋ 导入',
                  h('input', {
                    type: 'file',
                    accept: '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2',
                    style: { display: 'none' },
                    onChange: (event) => {
                      const picked = event.currentTarget.files && event.currentTarget.files[0];
                      if (picked && props.onImportFont) props.onImportFont(picked);
                      event.currentTarget.value = '';
                    },
                  })
                )
              ),`,
  'custom fonts + import button'
);

// ③ FeishuPane：自定义字体状态与读写
swap(
  `      const applyType = useCallback((next) => {`,
  `      const [customFonts, setCustomFonts] = useState([]);
      useEffect(() => {
        let alive = true;
        (async () => {
          try {
            const list = await FontStore.all();
            const names = [];
            for (const item of list) {
              try {
                await registerFontFace(item.name, item.buffer);
                names.push(item.name);
              } catch {
                /* 单个字体坏了不影响其它 */
              }
            }
            if (alive) setCustomFonts(names);
          } catch {
            /* IndexedDB 不可用时忽略 */
          }
        })();
        return () => {
          alive = false;
        };
      }, []);
      const importFont = useCallback(
        async (file) => {
          try {
            const buffer = await file.arrayBuffer();
            const name = String(file.name || '本地字体').replace(/\\.[^.]+$/, '');
            await registerFontFace(name, buffer);
            await FontStore.put(name, buffer);
            setCustomFonts((prev) => (prev.includes(name) ? prev : [...prev, name]));
            applyType({ ...typeSet, font: name });
            setNotice('已导入字体：' + name);
          } catch (error) {
            setError('导入字体失败：' + error.message);
          }
        },
        [applyType, typeSet]
      );
      const removeFont = useCallback(
        async (name) => {
          try {
            await FontStore.remove(name);
          } catch {
            /* 删库失败也别拦着 UI */
          }
          setCustomFonts((prev) => prev.filter((item) => item !== name));
          if (typeSet.font === name) applyType({ ...typeSet, font: DEFAULT_TYPE.font });
        },
        [applyType, typeSet]
      );
      const applyType = useCallback((next) => {`,
  'pane custom fonts state'
);

// ④ 根节点字体栈支持自定义名
swap(
  `            '--fs-font': (FONT_CHOICES.find((choice) => choice.id === typeSet.font) || FONT_CHOICES[0]).stack,`,
  `            '--fs-font':
              (FONT_CHOICES.find((choice) => choice.id === typeSet.font) || {}).stack ||
              (customFonts.includes(typeSet.font)
                ? '"' + typeSet.font + '", system-ui, sans-serif'
                : FONT_CHOICES[0].stack),`,
  'root font stack'
);

// ⑤ 传 props
swap(
  `            typeSet,
            onTypeChange: applyType,`,
  `            typeSet,
            onTypeChange: applyType,
            customFonts,
            onImportFont: importFont,
            onRemoveFont: removeFont,`,
  'pass font props'
);

// ⑥ CSS
swap(
  `      .fs-type-reset{border:0;`,
  `      .fs-type-custom{display:flex;align-items:center;gap:2px}
      .fs-type-del{border:0;background:transparent;color:var(--fs-fg3);font-size:12px;line-height:1;padding:2px 3px;border-radius:5px}
      .fs-type-del:hover{background:rgba(229,72,77,.12);color:#e5484d}
      .fs-type-import{border-style:dashed;color:var(--fs-fg2);cursor:pointer;min-width:auto}
      .fs-type-import:hover{background:var(--fs-brand-soft);color:var(--fs-brand);border-style:solid}
      .fs-type-panel .fs-type-grid{max-height:120px;overflow-y:auto;padding-right:2px}
      .fs-type-reset{border:0;`,
  'css for custom fonts'
);

fs.writeFileSync(file, t, 'utf8');
console.log('done:', n);
