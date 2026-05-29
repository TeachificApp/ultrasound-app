with open('/home/ubuntu/ultrasound-assist/client/src/pages/admin/DigitalDownloadsAdmin.tsx', 'r') as f:
    lines = f.readlines()

# Lines 580-638 (0-indexed: 579-637) need to be replaced
# Line 580 starts with "      {/* Files */}"
# Line 638 ends with "  );"
# Line 639 is "}"

before = lines[:579]  # lines 1-579
after = lines[638:]   # lines 639+

new_lines = [
    '        </TabsContent>\n',
    '\n',
    '        {/* Files Tab */}\n',
    '        <TabsContent value="files" className="mt-4">\n',
    '          <FileManager productId={productId} files={product.files} />\n',
    '        </TabsContent>\n',
    '\n',
    '        {/* Students Tab */}\n',
    '        <TabsContent value="students" className="mt-4">\n',
    '          <DownloadStudentsTab productId={productId} onGrantAccess={() => setShowGrantDialog(true)} />\n',
    '          <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />\n',
    '        </TabsContent>\n',
    '\n',
    '        {/* Analytics Tab */}\n',
    '        <TabsContent value="analytics" className="mt-4">\n',
    '          <DownloadProductAnalytics productId={productId} productTitle={product.title} />\n',
    '        </TabsContent>\n',
    '\n',
    '        {/* Sales Tab */}\n',
    '        <TabsContent value="sales" className="mt-4">\n',
    '          <div className="flex justify-end mb-3">\n',
    '            <Button variant="outline" size="sm" className="text-teal-600 border-teal-300 hover:bg-teal-50" onClick={() => setShowGrantDialog(true)}>\n',
    '              <UserPlus className="w-4 h-4 mr-1" /> Grant Access to Student\n',
    '            </Button>\n',
    '          </div>\n',
    '          <DownloadSalesTab productId={productId} />\n',
    '          <GrantDownloadAccessDialog open={showGrantDialog} productId={productId} onClose={() => setShowGrantDialog(false)} />\n',
    '        </TabsContent>\n',
    '      </Tabs>\n',
    '    </div>\n',
    '  );\n',
    '}\n',
]

result = before + new_lines + after

with open('/home/ubuntu/ultrasound-assist/client/src/pages/admin/DigitalDownloadsAdmin.tsx', 'w') as f:
    f.writelines(result)

print(f"Done. Total lines: {len(result)}")
print("Check lines around 580:")
for i, l in enumerate(result[578:590], start=579):
    print(f"  {i}: {l}", end='')
