import React, { useMemo, useState } from "react";

/**
 * Formulario de configuración en caliente.
 *
 * Los campos y sus rangos los describe el backend en /api/settings (`spec`),
 * así que el panel no duplica reglas: valida el servidor y aquí solo se pinta.
 */
export default function Settings({ data, draft, setDraft, onSave, onReset, saving }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(data.groups));

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(data.values),
    [draft, data.values]
  );

  const byGroup = useMemo(() => {
    const map = new Map();
    for (const [key, spec] of Object.entries(data.spec)) {
      if (!map.has(spec.group)) map.set(spec.group, []);
      map.get(spec.group).push([key, spec]);
    }
    return map;
  }, [data.spec]);

  const toggleGroup = (g) => {
    const next = new Set(openGroups);
    next.has(g) ? next.delete(g) : next.add(g);
    setOpenGroups(next);
  };

  const set = (key, value) => setDraft({ ...draft, [key]: value });

  const changed = (key) =>
    JSON.stringify(draft[key]) !== JSON.stringify(data.values[key]);

  return (
    <div className="panel section">
      <div className="panel-head">
        <h2>Configuración · se aplica en caliente</h2>
        <div className="controls">
          {dirty && <span className="badge amber">cambios sin guardar</span>}
          <button className="primary" onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={() => setDraft(data.values)} disabled={!dirty}>
            Descartar
          </button>
          <button className="ghost" onClick={onReset}>
            Valores por defecto
          </button>
        </div>
      </div>

      {data.groups.map((group) => (
        <section key={group} className="settings-group">
          <button className="group-head" onClick={() => toggleGroup(group)}>
            <span>{openGroups.has(group) ? "▾" : "▸"} {group}</span>
          </button>

          {openGroups.has(group) && (
            <div className="settings-grid">
              {(byGroup.get(group) || []).map(([key, spec]) => (
                <label
                  key={key}
                  className={`${spec.type === "list_str" ? "full" : ""} ${
                    changed(key) ? "changed" : ""
                  }`}
                >
                  <span className="field-label">
                    {spec.label}
                    <code>{key}</code>
                  </span>
                  <Field spec={spec} value={draft[key]} onChange={(v) => set(key, v)} />
                  <small>{spec.help}</small>
                </label>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Field({ spec, value, onChange }) {
  if (spec.type === "bool") {
    return (
      <select value={value ? "true" : "false"} onChange={(e) => onChange(e.target.value === "true")}>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (spec.type === "choice") {
    return (
      <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {spec.choices.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    );
  }

  if (spec.type === "list_str") {
    return (
      <input
        value={Array.isArray(value) ? value.join(", ") : value}
        placeholder="BTCUSDT, ETHUSDT"
        onChange={(e) =>
          onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
        }
      />
    );
  }

  if (spec.type === "str") {
    return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  // int / float
  return (
    <input
      type="number"
      value={value ?? ""}
      min={spec.min}
      max={spec.max}
      step={spec.type === "int" ? 1 : "any"}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}
