import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  produto_id: string;
  variacao_id: string;
  nome: string;
  tamanho: string;
  cor: string;
  preco: number;
  quantidade: number;
  imagem: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variacao_id: string) => void;
  updateQuantity: (variacao_id: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const existingItem = get().items.find((i) => i.variacao_id === item.variacao_id);
        if (existingItem) {
          set({
            items: get().items.map((i) =>
              i.variacao_id === item.variacao_id
                ? { ...i, quantidade: i.quantidade + item.quantidade }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },
      removeItem: (variacao_id) => {
        set({ items: get().items.filter((i) => i.variacao_id !== variacao_id) });
      },
      updateQuantity: (variacao_id, quantity) => {
        set({
          items: get().items.map((i) =>
            i.variacao_id === variacao_id ? { ...i, quantidade: Math.max(1, quantity) } : i
          ),
        });
      },
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((acc, item) => acc + item.preco * item.quantidade, 0),
    }),
    {
      name: "dove-vinha-cart",
    }
  )
);
