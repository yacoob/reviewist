vim.g.lazyvim_check_order = false

return {
  { import = "lazyvim.plugins.extras.lang.svelte" },
  { import = "lazyvim.plugins.extras.lang.typescript" },
  {
    "nvim-treesitter/nvim-treesitter",
    opts = {
      ensure_installed = { "css" },
    },
  },
}
