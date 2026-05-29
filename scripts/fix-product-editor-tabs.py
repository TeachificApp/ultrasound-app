with open('/home/ubuntu/ultrasound-assist/client/src/pages/admin/DigitalDownloadsAdmin.tsx', 'r') as f:
    lines = f.readlines()

before = lines[:338]   # lines 1-338 (0-indexed 0-337)
after = lines[611:]    # lines 612+ (0-indexed 611+)

new_return = '''    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h3 className="text-lg font-semibold flex-1">{product.title}</h3>
        <Badge variant={product.status === "published" ? "default" : "outline"}>{product.status}</Badge>
        {product.slug && (
          <a href={`/downloads/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600">
              <Eye className="w-3 h-3 mr-1" /> Preview
            </Button>
          </a>
        )}
      </div>

      {/* Top Tabs — like Course admin */}
      <Tabs defaultValue="settings">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto gap-0">
          <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Settings
          </TabsTrigger>
          <TabsTrigger value="landing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" /> Landing Page
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Files
          </TabsTrigger>
          <TabsTrigger value="students" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Students
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="sales" className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 px-4 py-2 text-sm font-medium bg-transparent hover:text-teal-600">
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Sales
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4 space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Product Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Subtitle</Label>
                <Input value={form.subtitle ?? ""} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short tagline" />
              </div>
              <div>
                <Label>Description (Rich Text)</Label>
                <RichTextEditor
                  value={form.description ?? ""}
                  onChange={(html) => setForm({ ...form, description: html })}
                  placeholder="Detailed product description..."
                  minHeight={120}
                />
              </div>
              <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-700">Pricing</h4>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <Label>Price ($)</Label>
                    <Input type="number" min={0} step="0.01" value={form.price ?? "0.00"} onChange={(e) => setForm({ ...form, price: e.target.value })} disabled={form.isFree} placeholder="29.99" />
                    <p className="text-xs text-muted-foreground mt-1">{form.isFree ? "Free" : `$${parseFloat(form.price || "0").toFixed(2)}`}</p>
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <Switch checked={form.isFree ?? false} onCheckedChange={(v) => setForm({ ...form, isFree: v, price: v ? "0.00" : form.price })} />
                    <Label className="cursor-pointer">Free product</Label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={(form as any).bundleOnly ?? false} onCheckedChange={(v) => setForm({ ...form, bundleOnly: v } as any)} />
                  <label className="text-sm font-medium">Bundle Only</label>
                  <span className="text-xs text-muted-foreground">Cannot be purchased standalone</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={(form as any).showInLibrary ?? true} onCheckedChange={(v) => setForm({ ...form, showInLibrary: v } as any)} />
                  <div>
                    <label className="text-sm font-medium">Show in Education Library</label>
                    <p className="text-xs text-muted-foreground">Appears in the public Education Library.</p>
                  </div>
                </div>
              </div>
              <div>
                <Label>Thumbnail</Label>
                <div className="flex items-start gap-3 mt-1">
                  {form.thumbnailUrl ? (
                    <img src={form.thumbnailUrl} alt="" className="w-24 h-24 rounded object-cover border" />
                  ) : (
                    <div className="w-24 h-24 rounded border-2 border-dashed flex items-center justify-center bg-muted/30">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleThumbnailUpload} />
                    <Button size="sm" variant="outline" onClick={() => thumbnailInputRef.current?.click()} disabled={uploadingThumbnail}>
                      <Upload className="w-3 h-3 mr-1" /> {uploadingThumbnail ? "Uploading..." : "Upload Image"}
                    </Button>
                    <Input className="text-xs h-7" value={form.thumbnailUrl ?? ""} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="Or paste URL..." />
                    {form.thumbnailUrl && (
                      <button className="text-xs text-destructive hover:underline self-start" onClick={() => setForm({ ...form, thumbnailUrl: "" })}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <select className="border rounded px-2 py-1 text-sm bg-background" value={form.status ?? "draft"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="hidden">Hidden (URL only)</option>
                  <option value="private">Private (invite only)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* URL & SEO Settings */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><LinkIcon className="w-4 h-4 text-teal-600" /> URL &amp; SEO Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">URL Slug</Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/downloads/</span>
                  <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} placeholder="product-url-slug" className="flex-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only.</p>
              </div>
              <div>
                <Label className="text-sm">Meta Title (SEO)</Label>
                <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Leave blank to use product title" className="mt-1" maxLength={255} />
              </div>
              <div>
                <Label className="text-sm">Meta Description (SEO)</Label>
                <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder="Brief description for search engines (150-160 characters)" className="mt-1 resize-none h-20" maxLength={500} />
              </div>
              <div>
                <Label className="text-sm">Publish Domain Override</Label>
                <PublishDomainSelect value={publishDomain} onChange={setPublishDomain} />
                <p className="text-xs text-muted-foreground mt-1">Override the default publish domain for this download only.</p>
              </div>
              <Button size="sm" variant="outline" className="border-teal-300 text-teal-600 hover:bg-teal-50"
                disabled={updateSettingsMut.isPending}
                onClick={() => updateSettingsMut.mutate({ productId, slug: slug.trim() || product.slug, metaTitle: metaTitle.trim() || undefined, metaDescription: metaDescription.trim() || undefined, publishDomain: publishDomain || null })}
              >
                {updateSettingsMut.isPending ? "Saving..." : "Save URL & SEO"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMut.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
              {updateMut.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </TabsContent>

        {/* Landing Page Tab */}
        <TabsContent value="landing" className="mt-4">
          <div className="space-y-3">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
              <LayoutTemplate className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-teal-800">Landing Page Builder</p>
                <p className="text-xs text-teal-600 mt-0.5">Design your product landing page with blocks, images, pricing sections, and more.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/admin/downloads/${productId}/landing-builder`)}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors text-left"
              >
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <LayoutTemplate className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Open Full Builder</p>
                  <p className="text-xs text-gray-500">Edit blocks, layout, pricing, CTAs</p>
                </div>
              </button>
              {product.slug && (
                <a href={`/downloads/${product.slug}?preview=admin`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Eye className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Preview Landing Page</p>
                    <p className="text-xs text-gray-500">See how it looks to visitors</p>
                  </div>
                </a>
              )}
            </div>
            <div className="bg-white border border-purple-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">AI Generate Landing Page</p>
                  <p className="text-xs text-gray-500 mt-0.5">The AI will read your product title, description, and pricing to generate a complete block-based landing page.</p>
                </div>
              </div>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 w-full"
                disabled={aiGenerateLandingPage.isPending}
                onClick={() => aiGenerateLandingPage.mutate({ productId })}
              >
                {aiGenerateLandingPage.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating landing page...</>
                  : <><Sparkles className="w-4 h-4" /> Generate Landing Page with AI</>}
              </Button>
              {aiGenerateLandingPage.isPending && (
                <p className="text-xs text-purple-500 text-center mt-2">This may take 15–30 seconds while the AI builds your page...</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-4">
          <FileManager productId={productId} files={product.files} />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-4">
          <DownloadStudentsTab productId={productId} onGrantAccess={() => setShowGrantDialog(true)} />
          <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <DownloadProductAnalytics productId={productId} productTitle={product.title} />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" className="text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setShowGrantDialog(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Grant Access to Student
            </Button>
          </div>
          <DownloadSalesTab productId={productId} />
          <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
'''

result = before + [new_return] + after

with open('/home/ubuntu/ultrasound-assist/client/src/pages/admin/DigitalDownloadsAdmin.tsx', 'w') as f:
    f.writelines(result)

print(f"Done. Total lines: {len(result)}")
# Verify
with open('/home/ubuntu/ultrasound-assist/client/src/pages/admin/DigitalDownloadsAdmin.tsx', 'r') as f:
    content = f.read()
print(f"Has TabsList: {'TabsList' in content}")
print(f"Has DownloadStudentsTab: {'DownloadStudentsTab' in content}")
print(f"Has DownloadProductAnalytics: {'DownloadProductAnalytics' in content}")
print(f"Has duplicate closing brace issue: {content.count('function GrantDownloadAccessDialog')}")
