---
title: "My 2025 Development Setup: Tools, Configs, and Workflow"
tags: ["Developer Tools", "Productivity", "Setup", "Workflow"]
---

# My 2025 Development Setup: Tools, Configs, and Workflow

## Introduction

Starting 2025 with a fresh development environment setup. After years of accumulating tools and configs, I decided to document everything in one place—both for my future self and anyone looking to optimize their workflow. This is the foundation I'm building on for the year ahead.

## Hardware

### Main Machine

```
System: Framework Laptop 13 (AMD Ryzen 7040 Series)
RAM: 64GB DDR5
Storage: 2TB NVMe SSD
Display: 2256x1504 @ 60Hz
OS: Arch Linux (btw)
```

**Why Framework?**
- Fully repairable and upgradeable
- Excellent Linux support
- Sustainable hardware philosophy
- Modular ports (swap USB-C, HDMI, etc.)

### Peripherals

- **Keyboard**: ZSA Moonlander (Ergonomic split keyboard)
- **Mouse**: Logitech MX Master 3S
- **Monitor**: LG 32" 4K IPS (for when I dock)
- **Webcam**: Logitech C920 HD Pro
- **Microphone**: Blue Yeti (for occasional screencasts)

## Operating System & Window Manager

### Arch Linux + Hyprland

```bash
# Display server
Wayland

# Window Manager
Hyprland (tiling, animations, eye candy)

# Terminal
Alacritty (GPU-accelerated)

# Shell
Zsh + Starship prompt

# Application Launcher
Rofi (Wayland fork)

# Status Bar
Waybar

# Notification Daemon
Mako
```

### Why Hyprland?

Dynamic tiling with smooth animations. Best of both worlds:

```ini
# ~/.config/hypr/hyprland.conf

# Performance
decoration {
    rounding = 10
    blur {
        enabled = true
        size = 3
        passes = 1
    }
    drop_shadow = yes
    shadow_range = 4
}

animations {
    enabled = yes
    bezier = myBezier, 0.05, 0.9, 0.1, 1.05
    animation = windows, 1, 7, myBezier
    animation = windowsOut, 1, 7, default, popin 80%
    animation = fade, 1, 7, default
    animation = workspaces, 1, 6, default
}

# Keybinds
bind = SUPER, Return, exec, alacritty
bind = SUPER, Q, killactive
bind = SUPER, M, exit
bind = SUPER, V, togglefloating
bind = SUPER, P, exec, rofi -show drun

# Move focus
bind = SUPER, h, movefocus, l
bind = SUPER, l, movefocus, r
bind = SUPER, k, movefocus, u
bind = SUPER, j, movefocus, d

# Switch workspaces
bind = SUPER, 1, workspace, 1
bind = SUPER, 2, workspace, 2
# ... etc
```

## Terminal Setup

### Alacritty Config

```yaml
# ~/.config/alacritty/alacritty.yml

window:
  padding:
    x: 10
    y: 10
  opacity: 0.95

font:
  normal:
    family: JetBrainsMono Nerd Font
    style: Regular
  bold:
    family: JetBrainsMono Nerd Font
    style: Bold
  size: 12.0

colors:
  primary:
    background: '#1e1e2e'
    foreground: '#cdd6f4'
  
  normal:
    black:   '#45475a'
    red:     '#f38ba8'
    green:   '#a6e3a1'
    yellow:  '#f9e2af'
    blue:    '#89b4fa'
    magenta: '#f5c2e7'
    cyan:    '#94e2d5'
    white:   '#bac2de'

cursor:
  style:
    shape: Block
    blinking: On
```

### Zsh + Starship

```bash
# ~/.zshrc

# History
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt appendhistory
setopt sharehistory
setopt incappendhistory

# Plugins via zinit
source ~/.zinit/bin/zinit.zsh

zinit light zsh-users/zsh-autosuggestions
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions

# Starship prompt
eval "$(starship init zsh)"

# Aliases
alias ls='exa --icons'
alias ll='exa -la --icons'
alias cat='bat'
alias find='fd'
alias grep='rg'
alias vim='nvim'
alias lg='lazygit'

# Functions
mkcd() {
    mkdir -p "$1" && cd "$1"
}

extract() {
    if [ -f $1 ]; then
        case $1 in
            *.tar.bz2)   tar xjf $1     ;;
            *.tar.gz)    tar xzf $1     ;;
            *.bz2)       bunzip2 $1     ;;
            *.rar)       unrar x $1     ;;
            *.gz)        gunzip $1      ;;
            *.tar)       tar xf $1      ;;
            *.tbz2)      tar xjf $1     ;;
            *.tgz)       tar xzf $1     ;;
            *.zip)       unzip $1       ;;
            *.Z)         uncompress $1  ;;
            *.7z)        7z x $1        ;;
            *)           echo "'$1' cannot be extracted" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}

# Development environments
export EDITOR='nvim'
export VISUAL='nvim'
export PAGER='bat'

# Path additions
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
```

### Starship Config

```toml
# ~/.config/starship.toml

[character]
success_symbol = "[➜](bold green)"
error_symbol = "[✗](bold red)"

[directory]
truncation_length = 3
truncate_to_repo = true
format = "[$path]($style)[$read_only]($read_only_style) "

[git_branch]
symbol = " "
format = "on [$symbol$branch]($style) "

[git_status]
format = '([\[$all_status$ahead_behind\]]($style) )'

[rust]
symbol = " "
format = "via [$symbol$version]($style) "

[nodejs]
symbol = " "
format = "via [$symbol$version]($style) "

[python]
symbol = " "
format = "via [$symbol$version]($style) "

[cmd_duration]
min_time = 500
format = "took [$duration]($style) "
```

## Development Tools

### Code Editor: Neovim

```lua
-- ~/.config/nvim/init.lua

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Leader key
vim.g.mapleader = " "

-- Plugins
require("lazy").setup({
  -- Theme
  {
    "catppuccin/nvim",
    name = "catppuccin",
    config = function()
      vim.cmd.colorscheme("catppuccin-mocha")
    end
  },
  
  -- LSP
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",
    },
  },
  
  -- Autocomplete
  {
    "hrsh7th/nvim-cmp",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "L3MON4D3/LuaSnip",
    },
  },
  
  -- Treesitter
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
  },
  
  -- Telescope
  {
    "nvim-telescope/telescope.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
  },
  
  -- File explorer
  {
    "nvim-tree/nvim-tree.lua",
    dependencies = { "nvim-tree/nvim-web-devicons" },
  },
  
  -- Git integration
  { "lewis6991/gitsigns.nvim" },
  { "tpope/vim-fugitive" },
  
  -- Status line
  { "nvim-lualine/lualine.nvim" },
  
  -- Rust tools
  { "simrat39/rust-tools.nvim" },
  
  -- Copilot
  { "github/copilot.vim" },
})

-- Basic settings
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.expandtab = true
vim.opt.shiftwidth = 4
vim.opt.tabstop = 4
vim.opt.smartindent = true
vim.opt.wrap = false
vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.undofile = true
vim.opt.hlsearch = false
vim.opt.incsearch = true
vim.opt.termguicolors = true
vim.opt.scrolloff = 8
vim.opt.signcolumn = "yes"
vim.opt.updatetime = 50

-- Keymaps
vim.keymap.set("n", "<leader>pv", vim.cmd.Ex)
vim.keymap.set("n", "<leader>ff", "<cmd>Telescope find_files<cr>")
vim.keymap.set("n", "<leader>fg", "<cmd>Telescope live_grep<cr>")
vim.keymap.set("n", "<leader>e", "<cmd>NvimTreeToggle<cr>")
```

### Version Control: Git

```bash
# ~/.gitconfig

[user]
    name = mxnish
    email = your-email@example.com
    signingkey = YOUR_GPG_KEY

[commit]
    gpgsign = true

[core]
    editor = nvim
    pager = delta

[interactive]
    diffFilter = delta --color-only

[delta]
    navigate = true
    light = false
    side-by-side = true
    line-numbers = true

[merge]
    conflictstyle = diff3

[diff]
    colorMoved = default

[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    unstage = reset HEAD --
    last = log -1 HEAD
    visual = log --graph --oneline --all --decorate
    amend = commit --amend --no-edit
```

### Languages & Runtimes

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add rust-analyzer rustfmt clippy

# Node.js (via fnm)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install --lts

# Python (via pyenv)
curl https://pyenv.run | bash
pyenv install 3.12.0
pyenv global 3.12.0

# Go
sudo pacman -S go

# Bun (faster npm alternative)
curl -fsSL https://bun.sh/install | bash
```

## Productivity Tools

### Task Management

```bash
# Using taskwarrior
sudo pacman -S task

# Add tasks
task add "Fix memory leak in DedCore" project:dedcore priority:H
task add "Write blog post about Rust" project:blog

# List tasks
task list

# Complete task
task 1 done
```

### Note Taking: Obsidian

- Store notes in `~/Documents/obsidian/`
- Sync via Git (private repo)
- Daily notes for journaling
- Zettelkasten method for knowledge management

### Time Tracking: Timewarrior

```bash
# Start tracking
timew start "Working on DedCore"

# Stop
timew stop

# Summary
timew summary :week
```

## Browser Setup: Firefox

### Extensions

- **uBlock Origin**: Ad blocking
- **Bitwarden**: Password manager
- **Dark Reader**: Dark mode for websites
- **Vimium**: Vim keybindings for browsing
- **Refined GitHub**: Better GitHub UI
- **Wappalyzer**: Detect tech stacks

### Firefox Config

```
about:config tweaks:

privacy.resistFingerprinting = true
network.http.referer.XOriginPolicy = 2
browser.safebrowsing.malware.enabled = true
browser.safebrowsing.phishing.enabled = true
```

## Backup Strategy

### Automated Backups

```bash
#!/bin/bash
# ~/scripts/backup.sh

# Backup important configs
BACKUP_DIR="$HOME/Backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Configs
cp -r ~/.config/nvim "$BACKUP_DIR/"
cp -r ~/.config/hypr "$BACKUP_DIR/"
cp ~/.zshrc "$BACKUP_DIR/"
cp ~/.gitconfig "$BACKUP_DIR/"

# Code projects
rsync -av --progress ~/Projects/ "$BACKUP_DIR/Projects/"

# Upload to cloud
rclone sync "$BACKUP_DIR" remote:backups/

echo "Backup complete: $BACKUP_DIR"
```

Automated via systemd timer to run daily.

## Dotfiles Management

Everything version controlled:

```bash
# Using GNU Stow
cd ~/dotfiles
stow nvim
stow zsh
stow hypr
stow git
```

Public repo: `github.com/mxnish/dotfiles` (sanitized)

## What's Next

This setup will evolve throughout 2025 as I:

1. **Build Rust projects** (DedCore, RustyTasks)
2. **Explore Solana development** (Need to add Solana CLI tools)
3. **Contribute to open source** (Rust, Clippy, etc.)
4. **Write technical blog posts** (This workflow makes it easy)

The goal: maximum productivity with minimal friction.

---

*Want to see my full dotfiles? Check out [github.com/mxnish/dotfiles](https://github.com/mxnish/dotfiles)*
