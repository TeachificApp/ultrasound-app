import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Package, ChevronLeft, ChevronRight, X, Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The native All About Ultrasound Printful store
const AAUS_STORE_ID = 15173664;

interface CartItem {
  syncVariantId: number;
  variantId: number;
  productName: string;
  variantName: string;
  retailPrice: string;
  currency: string;
  thumbnailUrl: string | null;
  quantity: number;
}

interface ParsedVariant {
  id: number;
  name: string;
  sku: string | null;
  retailPrice: string;
  currency: string;
  thumbnailUrl: string | null;
  variantId: number;
  product: { variant_id: number; product_id: number; image: string; name: string };
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────

function CartDrawer({
  open,
  onClose,
  cart,
  onUpdateQty,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (syncVariantId: number, qty: number) => void;
  onRemove: (syncVariantId: number) => void;
}) {
  const total = cart.reduce((sum, item) => sum + parseFloat(item.retailPrice) * item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Cart ({cart.length})
          </DialogTitle>
        </DialogHeader>

        {cart.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.syncVariantId} className="flex gap-3 items-start">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.variantName} className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.variantName}</p>
                  <p className="text-sm font-semibold text-teal-600 mt-0.5">
                    ${item.retailPrice}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => onUpdateQty(item.syncVariantId, Math.max(1, item.quantity - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm w-4 text-center">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => onUpdateQty(item.syncVariantId, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(item.syncVariantId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="border-t pt-3 flex items-center justify-between font-semibold">
              <span>Subtotal</span>
              <span className="text-teal-600">${total.toFixed(2)}</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Shipping calculated at checkout. Orders are fulfilled and shipped by Printful.
            </p>

            <Button className="w-full bg-teal-600 hover:bg-teal-700" disabled>
              Checkout (coming soon)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Product Detail Dialog ─────────────────────────────────────────────────────

function ProductDetailDialog({
  product,
  onClose,
  onAddToCart,
}: {
  product: { id: number; name: string; thumbnailUrl: string | null; variantsJson: string | null };
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}) {
  const variants: ParsedVariant[] = product.variantsJson
    ? (JSON.parse(product.variantsJson) as ParsedVariant[])
    : [];

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id.toString() ?? ""
  );
  const [qty, setQty] = useState(1);

  const selectedVariant = variants.find((v) => v.id.toString() === selectedVariantId);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image */}
          {selectedVariant?.thumbnailUrl || product.thumbnailUrl ? (
            <img
              src={selectedVariant?.thumbnailUrl ?? product.thumbnailUrl ?? ""}
              alt={product.name}
              className="w-full h-64 object-contain rounded-lg bg-muted"
            />
          ) : (
            <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}

          {/* Variant selector */}
          {variants.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-1 block">Variant</label>
              <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.name} — ${v.retailPrice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Price */}
          {selectedVariant && (
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-teal-600">
                ${selectedVariant.retailPrice}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-6 text-center font-medium">{qty}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setQty(qty + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Button
            className="w-full bg-teal-600 hover:bg-teal-700"
            disabled={!selectedVariant}
            onClick={() => {
              if (!selectedVariant) return;
              onAddToCart({
                syncVariantId: selectedVariant.id,
                variantId: selectedVariant.variantId,
                productName: product.name,
                variantName: selectedVariant.name,
                retailPrice: selectedVariant.retailPrice,
                currency: selectedVariant.currency,
                thumbnailUrl: selectedVariant.thumbnailUrl ?? product.thumbnailUrl,
                quantity: qty,
              });
              onClose();
            }}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to Cart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MerchStore() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
    thumbnailUrl: string | null;
    variantsJson: string | null;
  } | null>(null);

  const productsQuery = trpc.printful.listProducts.useQuery({ storeId: AAUS_STORE_ID });
  const products = productsQuery.data ?? [];

  function addToCart(item: CartItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.syncVariantId === item.syncVariantId);
      if (existing) {
        return prev.map((c) =>
          c.syncVariantId === item.syncVariantId
            ? { ...c, quantity: c.quantity + item.quantity }
            : c
        );
      }
      return [...prev, item];
    });
    setCartOpen(true);
  }

  function updateQty(syncVariantId: number, qty: number) {
    setCart((prev) => prev.map((c) => (c.syncVariantId === syncVariantId ? { ...c, quantity: qty } : c)));
  }

  function removeFromCart(syncVariantId: number) {
    setCart((prev) => prev.filter((c) => c.syncVariantId !== syncVariantId));
  }

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Merch Store</h1>
            <p className="text-sm text-muted-foreground">Official All About Ultrasound™ merchandise</p>
          </div>
          <Button
            variant="outline"
            className="relative"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Cart
            {cartCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-teal-600">
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Product grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No products available yet</p>
            <p className="text-sm mt-1">Check back soon for official merchandise.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => {
              const variants = (p.variants ?? []) as ParsedVariant[];
              const price = p.retailPrice ?? variants[0]?.retailPrice;
              return (
                <Card
                  key={p.id}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() =>
                    setSelectedProduct({
                      id: p.id,
                      name: p.name,
                      thumbnailUrl: p.thumbnailUrl,
                      variantsJson: p.variantsJson,
                    })
                  }
                >
                  {p.thumbnailUrl ? (
                    <img
                      src={p.thumbnailUrl}
                      alt={p.name}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <Package className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                    {price && (
                      <p className="text-teal-600 font-semibold mt-1">${price}</p>
                    )}
                    {variants.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {variants.length} variants
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Product detail dialog */}
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
        />
      )}

      {/* Cart drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
      />
    </div>
  );
}
