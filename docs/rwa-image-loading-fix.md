# RWA image loading

RWA list and detail images use the wallet metadata thumbnail directly for HTTP(S)
URLs. The existing API mapper prefers `metadata.thumbnailUri` and falls back to
`metadata.icon`. Proxy URLs remain fallback candidates; metadata without a thumbnail
retains the legacy collectible image stack. Regular token URL construction is unchanged.

`useImagesStackLoading` resets only when the ordered URL values change, rather than
when the source array reference changes. This preserves successful images, selected
fallbacks, and exhausted stacks across owner snapshot replacements. Changing a URL
still starts a new load. No image cache or polling changes were introduced.

RWA detail loading does not replace an image when metadata is already available.
The list waits for adult classification only when adult blur is enabled.

Regression coverage: `src/lib/ui/ImageStacked.test.tsx` checks direct RWA URLs,
DOM image identity, loaded state, fallback retention, exhausted stacks, and URL
changes for both RWA and regular token source stacks. These are simulated DOM
load/error tests; installed-extension network behavior requires manual acceptance.

Manual acceptance: open the RWA list and a detail page with the browser Network
panel visible. Let balance/metadata refreshes complete. An unchanged thumbnail
should keep its image element and source; changing its metadata URL should load
the new image. A failed source should advance to a fallback without restarting
on unrelated updates.
