import React, { useState } from 'react';
import { Props } from './types';

interface PropsFormProps {
  props:      Props;
  onChange:   (p: Props) => void;
  gpxFiles:   string[];
  onUpload:   () => void;  // called after a successful GPX upload
}

// ── Helpers ───────────────────────────────────────────────────────────────

function set<K extends keyof Props>(props: Props, key: K, value: Props[K]): Props {
  return { ...props, [key]: value };
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="color-row">
        <div className="color-preview">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>
        <input
          type="text"
          className="color-hex"
          value={value}
          onChange={e => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

interface RangeFieldProps {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step?:    number;
  unit?:    string;
  onChange: (v: number) => void;
}

function RangeField({ label, value, min, max, step = 1, unit = '', onChange }: RangeFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="range-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <span className="range-value">{value}{unit}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PropsForm({ props, onChange, gpxFiles, onUpload }: PropsFormProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [uploadMsg,    setUploadMsg]    = useState('');

  function upd<K extends keyof Props>(key: K, value: Props[K]) {
    onChange(set(props, key, value));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.gpx')) {
      setUploadStatus('error');
      setUploadMsg('Only .gpx files are supported.');
      return;
    }
    setUploadStatus('idle');
    setUploadMsg('Uploading…');
    const form = new FormData();
    form.append('gpxFile', file);
    try {
      const res = await fetch('/api/upload-gpx', { method: 'POST', body: form });
      if (res.ok) {
        setUploadStatus('ok');
        setUploadMsg(`✓ ${file.name} uploaded`);
        onUpload();
        // Auto-select the uploaded file and switch to GPX mode
        onChange({ ...props, mode: 'gpx', gpxFile: file.name });
      } else {
        const text = await res.text();
        setUploadStatus('error');
        setUploadMsg(text || 'Upload failed.');
      }
    } catch {
      setUploadStatus('error');
      setUploadMsg('Network error during upload.');
    }
    // Reset file input
    e.target.value = '';
  }

  return (
    <div>
      {/* ── Mode ─────────────────────────────────────────────────── */}
      <div className="form-section">
        <div className="section-title">Mode</div>
        <div className="field">
          <div className="radio-group">
            <input
              type="radio" id="mode-dir" name="mode"
              checked={props.mode === 'directions'}
              onChange={() => upd('mode', 'directions')}
            />
            <label htmlFor="mode-dir">Directions</label>
            <input
              type="radio" id="mode-gpx" name="mode"
              checked={props.mode === 'gpx'}
              onChange={() => upd('mode', 'gpx')}
            />
            <label htmlFor="mode-gpx">GPX track</label>
          </div>
        </div>
      </div>

      {/* ── Route (Directions mode) ───────────────────────────────── */}
      {props.mode === 'directions' && (
        <div className="form-section">
          <div className="section-title">Route</div>
          <div className="field">
            <label>Start address</label>
            <input
              type="text"
              value={props.startAddress}
              onChange={e => upd('startAddress', e.target.value)}
              placeholder="e.g. Ghent, Belgium"
            />
          </div>
          <div className="field">
            <label>Start label</label>
            <input
              type="text"
              value={props.startLabel}
              onChange={e => upd('startLabel', e.target.value)}
              placeholder="Short name on the map"
            />
          </div>
          <div className="field">
            <label>End address</label>
            <input
              type="text"
              value={props.endAddress}
              onChange={e => upd('endAddress', e.target.value)}
              placeholder="e.g. Paris, France"
            />
          </div>
          <div className="field">
            <label>End label</label>
            <input
              type="text"
              value={props.endLabel}
              onChange={e => upd('endLabel', e.target.value)}
              placeholder="Short name on the map"
            />
          </div>
        </div>
      )}

      {/* ── GPX file (GPX mode) ───────────────────────────────────── */}
      {props.mode === 'gpx' && (
        <div className="form-section">
          <div className="section-title">GPX file</div>
          <div className="field">
            <label>Select track</label>
            <select
              value={props.gpxFile}
              onChange={e => upd('gpxFile', e.target.value)}
            >
              <option value="">— choose a file —</option>
              {gpxFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Upload new GPX</label>
            <div className="upload-area">
              <input
                type="file"
                accept=".gpx"
                onChange={handleFileUpload}
              />
              Click to upload a .gpx file
            </div>
            {uploadMsg && (
              <div className={`upload-status ${uploadStatus}`}>{uploadMsg}</div>
            )}
          </div>
          {/* Labels for GPX mode */}
          <div className="field-row">
            <div className="field">
              <label>Start label</label>
              <input
                type="text"
                value={props.startLabel}
                onChange={e => upd('startLabel', e.target.value)}
              />
            </div>
            <div className="field">
              <label>End label</label>
              <input
                type="text"
                value={props.endLabel}
                onChange={e => upd('endLabel', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Map ──────────────────────────────────────────────────── */}
      <div className="form-section">
        <div className="section-title">Map</div>
        <div className="field">
          <label>Zoom mode</label>
          <div className="radio-group">
            <input
              type="radio" id="zoom-auto" name="zoomMode"
              checked={props.zoomMode === 'auto'}
              onChange={() => upd('zoomMode', 'auto')}
            />
            <label htmlFor="zoom-auto">Auto</label>
            <input
              type="radio" id="zoom-manual" name="zoomMode"
              checked={props.zoomMode === 'manual'}
              onChange={() => upd('zoomMode', 'manual')}
            />
            <label htmlFor="zoom-manual">Manual</label>
          </div>
        </div>
        {props.zoomMode === 'manual' && (
          <RangeField
            label="Zoom level"
            value={props.zoom}
            min={1} max={20} step={0.1}
            onChange={v => upd('zoom', v)}
          />
        )}
        <div className="field">
          <label>City label filter (min. population)</label>
          <input
            type="number"
            value={props.minPopulation}
            min={0} max={15000000} step={50000}
            onChange={e => upd('minPopulation', Number(e.target.value))}
          />
        </div>
      </div>

      {/* ── Track line ───────────────────────────────────────────── */}
      <div className="form-section">
        <div className="section-title">Track line</div>
        <div className="field">
          <label>Style</label>
          <select
            value={props.lineStyle}
            onChange={e => upd('lineStyle', e.target.value as Props['lineStyle'])}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="long-dash">Long dash</option>
            <option value="dash-dot">Dash-dot</option>
            <option value="pencil">Pencil (hand-drawn)</option>
          </select>
        </div>
        {props.lineStyle === 'pencil' && (
          <RangeField
            label="Pencil strength"
            value={props.pencilStrength}
            min={1} max={10}
            onChange={v => upd('pencilStrength', v)}
          />
        )}
        <ColorField
          label="Line color"
          value={props.lineColor}
          onChange={v => upd('lineColor', v)}
        />
        <RangeField
          label="Line width"
          value={props.lineWidth}
          min={1} max={20}
          onChange={v => upd('lineWidth', v)}
        />
      </div>

      {/* ── Labels ───────────────────────────────────────────────── */}
      <div className="form-section">
        <div className="section-title">Labels</div>
        <ColorField
          label="Label background"
          value={props.labelBgColor}
          onChange={v => upd('labelBgColor', v)}
        />
        <ColorField
          label="Label text color"
          value={props.labelTextColor}
          onChange={v => upd('labelTextColor', v)}
        />
      </div>

      {/* ── Animation ────────────────────────────────────────────── */}
      <div className="form-section">
        <div className="section-title">Animation</div>
        <RangeField
          label="Duration"
          value={props.duration}
          min={1} max={60} unit="s"
          onChange={v => upd('duration', v)}
        />
      </div>
    </div>
  );
}
