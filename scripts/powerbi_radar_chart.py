"""
Radar chart para o visual Python do Power BI (dataset = `dataset`).

- Valores no raio = números da tabela (sem normalização).
- Rótulos FM: só valores, lado a lado, cor = série; nome da métrica em cima.

Tema **RED SLIDE**: painel escuro tipo “card” que contrasta com fundos vermelhos
(Instagram / Liverpool); grelha e texto claros; séries em ciano/ouro/etc. (nada de vermelho puro).

Rótulos: âncora no **limite exterior** do radar (r = ymax) + grande offset em pontos
para ficarem **fora** da malha — ajusta LABEL_* no bloco config se precisares.
"""

import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import pandas as pd

# --- tema: slide vermelho + aspeto moderno --------------------------------
# Fundo transparente (para export sem caixa)
FIG_BG = "none"
AX_BG = "none"

GRID = "#ffffff"
GRID_ALPHA = 0.60
GRID_LW = 0.60
SPINE = "#94a3b8"
SPINE_ALPHA = 0.45

# Títulos de métrica e legenda
TEXT = "#000000"
TEXT_METRIC = "#000000"

# Séries: ordem fixa — contrasts bem em fundo escuro; evita vermelho
COLORS = [
    "#00E5FF",  # cyan
    "#FFD60A",  # yellow
    "#14532D",  # dark green (3rd player)
    "#B388FF",  # purple
    "#FF9F1C",  # orange
    "#4DA3FF",  # blue
    "#F472B6",  # pink
    "#FDE68A",  # soft amber
]

# Rótulos fora da malha (coords do eixo). Caixa verde maior (figsize) = mais margem.
LABEL_RADIUS_METRIC = 0.61
LABEL_RADIUS_VALUES = 0.56
LABEL_SPACING_FIG = 0.042   # espaçamento horizontal entre valores (fração eixo)

# Área do polar (resto = verde #00ff00 para remove bg no Canva)
SUBPLOT_RECT = [0.14, 0.16, 0.72, 0.66]  # left, bottom, width, height

# Só rótulos das métricas (Goals + Ast /90, etc.)
METRIC_FONTSIZE = 13

mpl.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.sans-serif": [
            "Segoe UI",
            "Arial",
            "Helvetica",
            "DejaVu Sans",
        ],
        "font.size": 10,
        "figure.facecolor": FIG_BG,
    }
)


def pick_col(df, keywords):
    for c in df.columns:
        cl = str(c).lower()
        for k in keywords:
            if k in cl:
                return c
    return None


df = dataset.copy()

c_player = pick_col(df, ["name", "player", "jogador"])
c_metric = pick_col(df, ["metric", "attribute", "stat"])
c_value = pick_col(df, ["value", "valor"])

if c_player is None or c_metric is None or c_value is None:
    raise ValueError(
        "Colunas necessárias: jogador + métrica + valor. "
        f"Encontrado player={c_player}, metric={c_metric}, value={c_value}. "
        f"Colunas atuais: {list(df.columns)}"
    )

df[c_metric] = (
    df[c_metric]
    .astype(str)
    .str.strip()
    .replace({"nan": np.nan, "None": np.nan, "": np.nan})
)

df[c_value] = pd.to_numeric(df[c_value], errors="coerce")

df = df.dropna(subset=[c_player, c_metric, c_value])

df = (
    df[[c_player, c_metric, c_value]]
    .groupby([c_player, c_metric], as_index=False)[c_value]
    .mean()
)

piv = df.pivot(index=c_player, columns=c_metric, values=c_value)
piv = piv.dropna(axis=1, how="all").dropna(axis=0, how="all")

metrics = [m for m in piv.columns if pd.notna(m) and str(m).strip()]
metrics = sorted([str(m) for m in metrics], key=str.lower)

n = len(metrics)
if n < 3:
    raise ValueError("São precisas pelo menos 3 métricas com valores.")

angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
angles_closed = angles + [angles[0]]

sub = piv[metrics].apply(pd.to_numeric, errors="coerce")
ymax = float(np.nanmax(sub.values))
ymax = max(ymax * 1.08, 1e-9)

fig = plt.figure(figsize=(7.2, 7.2), facecolor=FIG_BG)
ax = fig.add_axes(SUBPLOT_RECT, polar=True, facecolor=AX_BG)

fig.patch.set_facecolor(FIG_BG)
ax.set_facecolor(AX_BG)

ax.set_theta_offset(np.pi / 2)
ax.set_theta_direction(-1)

ax.set_ylim(0, ymax)
ax.grid(
    color=GRID,
    linestyle="-",
    linewidth=GRID_LW,
    alpha=GRID_ALPHA,
)
ax.spines["polar"].set_color(SPINE)
ax.spines["polar"].set_alpha(SPINE_ALPHA)

ax.set_xticks(angles)
ax.set_xticklabels([""] * n)
ax.set_yticklabels([])

players_list = list(piv.index)
npl = len(players_list)
spacing_x = LABEL_SPACING_FIG if npl <= 2 else max(0.018, 0.070 / npl)

# Desenhar labels em coordenadas do eixo para garantir leitura fora da malha
# Mapeamento com theta_offset(pi/2) e direção clockwise:
# x = 0.5 + r * sin(theta), y = 0.5 + r * cos(theta)
for i, m in enumerate(metrics):
    ang = angles[i]
    ux = np.sin(ang)
    uy = np.cos(ang)

    metric_r = LABEL_RADIUS_METRIC
    if "shots" in m.lower():
        metric_r = LABEL_RADIUS_METRIC - 0.05  # sobe ligeiramente o rótulo inferior
    xm = 0.5 + metric_r * ux
    ym = 0.5 + metric_r * uy
    xv = 0.5 + LABEL_RADIUS_VALUES * ux
    yv = 0.5 + LABEL_RADIUS_VALUES * uy

    ax.text(
        xm,
        ym,
        m,
        transform=ax.transAxes,
        ha="center",
        va="center",
        fontsize=METRIC_FONTSIZE,
        fontweight="bold",
        color=TEXT_METRIC,
        bbox=dict(facecolor="none", edgecolor="none", alpha=0.0, pad=1.8),
        clip_on=False,
    )

    # valores por jogador removidos a pedido (mantém só nome da métrica)

for idx, player in enumerate(piv.index):
    row = piv.loc[player]
    vals = [float(row[m]) for m in metrics]
    vals_c = vals + [vals[0]]
    c = COLORS[idx % len(COLORS)]
    ax.plot(
        angles_closed,
        vals_c,
        linewidth=2.35,
        color=c,
        label=str(player),
        marker="o",
        markersize=6,
        markeredgecolor="#fffdf8",
        markeredgewidth=0.6,
    )
    ax.fill(angles_closed, vals_c, color=c, alpha=0.16)

leg = ax.legend(
    loc="upper center",
    bbox_to_anchor=(0.5, -0.06),
    ncol=min(3, len(piv.index)),
    frameon=False,
    fontsize=12,
)
for t in leg.get_texts():
    t.set_color(TEXT)
    t.set_fontweight("bold")

plt.show()
