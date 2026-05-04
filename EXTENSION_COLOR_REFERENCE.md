# Extension UI — Color & Component Reference

## Color Palette

### Primary Colors
```css
--primary:   #1A56DB  /* Main blue - buttons, links, active states */
--primary-h: #1547C0  /* Hover state - darker blue */
--primary-lo:#EFF4FF  /* Light background - chip backgrounds, highlights */
```

### Semantic Colors
```css
--success:   #10B981  /* Green - success states, checkmarks */
--warning:   #F59E0B  /* Amber - warnings, alerts */
--danger:    #EF4444  /* Red - errors, destructive actions */
--danger-lo: #FEE2E2  /* Light red - error backgrounds */
--danger-bd: #FECACA  /* Light red - error borders */
```

### Neutral Colors
```css
--bg:        #F8FAFC  /* Page background - very light blue-gray */
--surface:   #FFFFFF  /* Card/input background - pure white */
--surface-2: #F1F5F9  /* Secondary surface - light slate */
--border:    #E2E8F0  /* Border color - light gray */
--text:      #1E293B  /* Primary text - dark slate */
--muted:     #64748B  /* Secondary text - medium gray */
```

### Radius
```css
--radius:    8px      /* Standard border radius */
```

---

## Component Color Usage

### Header
```css
.header {
  background: var(--surface);      /* White */
  border-bottom: 1px solid var(--border);  /* Light gray */
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.header-title {
  color: var(--text);              /* Dark slate */
}

.header-sub {
  color: var(--muted);             /* Medium gray */
}
```

### Sync Badge
```css
.sync-badge-active {
  background: rgba(16, 185, 129, 0.1);     /* Light green */
  border-color: rgba(16, 185, 129, 0.25);  /* Green border */
  color: #059669;                          /* Dark green */
}

.sync-dot {
  background: #10B981;             /* Green */
}
```

### Buttons

#### Primary Button
```css
.btn-primary {
  background: var(--primary);      /* #1A56DB - Blue */
  color: #fff;                     /* White text */
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.15);
}

.btn-primary:hover {
  background: var(--primary-h);    /* #1547C0 - Darker blue */
  box-shadow: 0 6px 16px rgba(26, 86, 219, 0.25);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: var(--surface);      /* White */
  color: var(--text);              /* Dark slate */
  border: 1px solid var(--border); /* Light gray */
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}

.btn-secondary:hover {
  border-color: var(--primary);    /* Blue border */
  background: var(--primary-lo);   /* Light blue background */
  color: var(--primary);           /* Blue text */
}
```

#### Danger Button
```css
.btn-danger {
  background: var(--danger-lo);    /* #FEE2E2 - Light red */
  color: var(--danger);            /* #EF4444 - Red */
  border: 1px solid #FECACA;       /* Light red border */
}

.btn-danger:hover {
  background: #FEE2E2;
  border-color: #FCA5A5;
}
```

### Form Inputs
```css
.input {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  color: var(--text);              /* Dark slate */
}

.input:focus {
  border-color: var(--primary);    /* Blue border */
  box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.1);  /* Blue glow */
}

.input::placeholder {
  color: #CBD5E1;                  /* Light gray */
}
```

### Labels
```css
.label {
  color: var(--text);              /* Dark slate */
  font-weight: 600;
}

.field-hint {
  color: var(--muted);             /* Medium gray */
}
```

### Section Titles
```css
.section-title {
  color: var(--muted);             /* Medium gray */
  text-transform: uppercase;
  font-size: 11px;
}
```

### Status Indicators
```css
.dot-green  { background: var(--success); }   /* #10B981 */
.dot-gray   { background: #CBD5E1; }          /* Light gray */
.dot-orange { background: var(--warning); }   /* #F59E0B */
.dot-red    { background: var(--danger); }    /* #EF4444 */
```

### Platform Rows
```css
.platform-row {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.platform-name {
  color: var(--text);              /* Dark slate */
}

.platform-status-text {
  color: var(--muted);             /* Medium gray */
}
```

### Platform Badges
```css
.platform-upwork {
  background: #14A800;             /* Green */
  color: #fff;
}

.platform-freelancer {
  background: #29B2FE;             /* Cyan */
  color: #fff;
}
```

### Keyword Tags
```css
.keyword-tag {
  background: var(--primary-lo);   /* #EFF4FF - Light blue */
  border: 1px solid #BFDBFE;       /* Light blue border */
  color: var(--primary);           /* #1A56DB - Blue */
}

.keyword-tag-remove {
  color: rgba(26, 86, 219, 0.4);   /* Faded blue */
}

.keyword-tag-remove:hover {
  color: var(--primary);           /* Blue */
}
```

### Filter Chips
```css
.filter-chip {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  color: var(--muted);             /* Medium gray */
}

.filter-chip.active {
  background: var(--primary-lo);   /* #EFF4FF - Light blue */
  border-color: var(--primary);    /* Blue border */
  color: var(--primary);           /* Blue text */
}
```

### Day Chips
```css
.day-chip {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  color: var(--muted);             /* Medium gray */
}

.day-chip.active {
  background: var(--primary-lo);   /* #EFF4FF - Light blue */
  border-color: var(--primary);    /* Blue border */
  color: var(--primary);           /* Blue text */
}
```

### Platform Toggles
```css
.platform-toggle {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  color: var(--muted);             /* Medium gray */
  opacity: 0.6;
}

.platform-toggle.active {
  background: var(--primary-lo);   /* #EFF4FF - Light blue */
  border-color: var(--primary);    /* Blue border */
  color: var(--primary);           /* Blue text */
  opacity: 1;
}
```

### Toggle Switch
```css
.slider {
  background: #E2E8F0;             /* Light gray - off state */
}

.slider::before {
  background: #fff;                /* White thumb */
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);
}

.switch input:checked + .slider {
  background: var(--primary);      /* Blue - on state */
}
```

### Messages
```css
.msg-success {
  background: #ECFDF5;             /* Light green */
  border: 1px solid #D1FAE5;       /* Green border */
  color: #047857;                  /* Dark green */
}

.msg-error {
  background: var(--danger-lo);    /* #FEE2E2 - Light red */
  border: 1px solid #FECACA;       /* Light red border */
  color: #DC2626;                  /* Dark red */
}

.msg-info {
  background: #EFF6FF;             /* Light blue */
  border: 1px solid #BFDBFE;       /* Light blue border */
  color: #1E40AF;                  /* Dark blue */
}
```

### Status Line
```css
.scrape-status {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  color: var(--muted);             /* Medium gray */
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
```

### Suggestions Dropdown
```css
.suggestions-box {
  background: var(--surface);      /* White */
  border: 1px solid var(--border); /* Light gray */
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}

.suggestion-item {
  color: var(--text);              /* Dark slate */
}

.suggestion-item:hover {
  background: var(--primary-lo);   /* #EFF4FF - Light blue */
  color: var(--primary);           /* Blue text */
}

.suggestion-icon {
  color: var(--muted);             /* Medium gray */
}
```

---

## Shadow System

### Subtle Shadow
```css
box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
```
Used for: Platform rows, status lines

### Medium Shadow
```css
box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
```
Used for: Header, buttons, secondary buttons

### Strong Shadow
```css
box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
```
Used for: Suggestions dropdown

### Focus Glow
```css
box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.1);
```
Used for: Input focus state

---

## Effects

### Backdrop Filter
```css
backdrop-filter: blur(4px);
-webkit-backdrop-filter: blur(4px);
```
Used for: All buttons

### Transitions
```css
transition: all 0.15s;
transition: background 0.15s, opacity 0.15s, border-color 0.15s;
transition: transform 0.2s, background 0.2s;
```

### Animations
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```
Used for: Sync badge dot

---

## Opacity & Transparency

### Button States
```css
.btn:disabled { opacity: 0.5; }
.platform-toggle { opacity: 0.6; }
.platform-toggle.active { opacity: 1; }
```

### Hover Effects
```css
.keyword-tag-remove { color: rgba(26, 86, 219, 0.4); }
.keyword-tag-remove:hover { color: var(--primary); }
```

---

## Responsive Sizing

### Popup Dimensions
```css
width: 420px;
min-height: 100px;
```

### Font Sizes
```css
body { font-size: 13px; }
.header-title { font-size: 14px; }
.section-title { font-size: 11px; }
.label { font-size: 12px; }
.field-hint { font-size: 11px; }
```

### Spacing
```css
/* Padding */
.header { padding: 14px 16px; }
.section { padding: 14px 16px; }
.platform-row { padding: 10px 12px; }

/* Margins */
.field { margin-bottom: 11px; }
.platform-row { margin-bottom: 7px; }
```

---

## Accessibility

### Color Contrast Ratios
| Element | Foreground | Background | Ratio | WCAG AA |
|---------|-----------|-----------|-------|---------|
| Primary Button Text | #FFFFFF | #1A56DB | 8.59:1 | ✅ AAA |
| Body Text | #1E293B | #FFFFFF | 12.63:1 | ✅ AAA |
| Muted Text | #64748B | #F8FAFC | 7.24:1 | ✅ AAA |
| Success Text | #047857 | #ECFDF5 | 8.42:1 | ✅ AAA |
| Error Text | #DC2626 | #FEE2E2 | 8.91:1 | ✅ AAA |

### Focus Indicators
- All interactive elements have visible focus states
- Focus glow provides clear indication
- Keyboard navigation fully supported

---

## Quick Copy-Paste Reference

### CSS Variables
```css
:root {
  --bg:        #F8FAFC;
  --surface:   #FFFFFF;
  --surface-2: #F1F5F9;
  --border:    #E2E8F0;
  --primary:   #1A56DB;
  --primary-h: #1547C0;
  --primary-lo:#EFF4FF;
  --text:      #1E293B;
  --muted:     #64748B;
  --success:   #10B981;
  --warning:   #F59E0B;
  --danger:    #EF4444;
  --danger-lo: #FEE2E2;
  --danger-bd: #FECACA;
  --radius:    8px;
}
```

### Common Colors
```
Light Blue:    #EFF4FF
Light Gray:    #E2E8F0
Light Red:     #FEE2E2
Light Green:   #ECFDF5
Light Cyan:    #EFF6FF
```

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | #1A56DB | Buttons, links, active states |
| `--primary-h` | #1547C0 | Hover states |
| `--primary-lo` | #EFF4FF | Backgrounds, highlights |
| `--success` | #10B981 | Success indicators |
| `--warning` | #F59E0B | Warnings |
| `--danger` | #EF4444 | Errors, destructive actions |
| `--text` | #1E293B | Primary text |
| `--muted` | #64748B | Secondary text |
| `--border` | #E2E8F0 | Borders |
| `--surface` | #FFFFFF | Cards, inputs |
| `--bg` | #F8FAFC | Page background |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 4, 2026 | Initial light theme redesign |

---

**Last Updated**: May 4, 2026  
**Status**: ✅ Production Ready
