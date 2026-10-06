type IncludedItemsIframeOptions = {
  src: string;
  source: "membership" | "bundle";
  id: number;
  title?: string;
};

/**
 * Builds a standalone included-items iframe with a resize listener installed
 * before the iframe begins loading. The initial height avoids a visible scroll
 * bar while the child reports its exact rendered height.
 */
export function buildIncludedItemsIframeSnippet({
  src,
  source,
  id,
  title = "Included items",
}: IncludedItemsIframeOptions): string {
  const frameId = `aau-included-items-${source}-${id}`;
  const safeTitle = title.replace(/"/g, "&quot;");

  return `<!-- All About Ultrasound Included Items -->
<script>
(function() {
  var frameId = "${frameId}";
  window.addEventListener("message", function(event) {
    if (!event.data || event.data.type !== "included-items-resize") return;
    var iframe = document.getElementById(frameId);
    var reportedHeight = Number(event.data.height);
    if (iframe && event.source === iframe.contentWindow && Number.isFinite(reportedHeight) && reportedHeight > 0) {
      var nextHeight = Math.max(200, Math.ceil(reportedHeight) + 24);
      iframe.style.height = nextHeight + "px";
      iframe.setAttribute("height", String(nextHeight));
    }
  });
})();
<\/script>
<iframe
  id="${frameId}"
  src="${src}"
  width="100%"
  height="800"
  style="width:100%;border:none;display:block;height:800px;min-height:200px;overflow:hidden;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
  title="${safeTitle}"
></iframe>`;
}
