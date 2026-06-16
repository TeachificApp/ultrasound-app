/**
 * CommunityDMs.tsx
 * Direct messages: conversation list + message thread.
 */
import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, MessageSquare, ChevronLeft, ArrowLeft } from "lucide-react";

function timeAgo(dateStr: string | Date) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString();
}

export default function CommunityDMs() {
  const { conversationId, userId } = useParams<{ conversationId?: string; userId?: string }>();
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [messageBody, setMessageBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // If userId param is present, get-or-create a conversation and redirect
  const getOrCreate = trpc.community.member.getOrCreateConversation.useMutation({
    onSuccess: (conv) => { navigate(`/community/dms/c/${conv.id}`, { replace: true }); },
    onError: (e) => toast.error(e.message),
  });
  useEffect(() => {
    if (userId && isAuthenticated && !conversationId) {
      getOrCreate.mutate({ otherUserId: parseInt(userId) });
    }
  }, [userId, isAuthenticated]);

  const { data: conversations, isLoading: convsLoading } = trpc.community.member.myConversations.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 15000 }
  );

  const activeConvId = conversationId ? parseInt(conversationId) : null;
  const activeConv = conversations?.find((c: any) => c.id === activeConvId);

  const { data: messages, isLoading: msgsLoading } = trpc.community.member.getMessages.useQuery(
    { conversationId: activeConvId! },
    { enabled: !!activeConvId && isAuthenticated, refetchInterval: 5000 }
  );

  const sendMessage = trpc.community.member.sendMessage.useMutation({
    onSuccess: () => {
      setMessageBody("");
      utils.community.member.getMessages.invalidate({ conversationId: activeConvId! });
      utils.community.member.myConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.items]);

  useEffect(() => {
    document.title = "Messages | Community | All About Ultrasound™";
    return () => { document.title = "All About Ultrasound™"; };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Sign in to view messages</h2>
                    <a href={getLoginUrl("/community/dms")}>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/community">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-teal-600">
              <ChevronLeft className="w-4 h-4" />Community
            </button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-180px)]">
          {/* Conversation list */}
          <Card className="md:col-span-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 text-sm">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convsLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : !conversations?.length ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv: any) => {
                  const other = conv.otherUser;
                  const isActive = conv.id === activeConvId;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => navigate(`/community/dms/c/${conv.id}`)})
                      className={`w-full text-left p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b ${isActive ? "bg-teal-50 border-l-2 border-l-teal-500" : ""}`}
                    >
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={other?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-sm bg-teal-100 text-teal-700">
                          {(other?.displayName || other?.name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 text-sm truncate">{other?.displayName || other?.name}</p>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</span>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge className="text-xs bg-teal-600 text-white mt-0.5">{conv.unreadCount} new</Badge>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          {/* Message thread */}
          <Card className="md:col-span-2 overflow-hidden flex flex-col">
            {!activeConvId ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a conversation to start messaging</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="p-4 border-b flex items-center gap-3">
                  {activeConv?.otherUser && (
                    <>
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={activeConv.otherUser.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-sm bg-teal-100 text-teal-700">
                          {(activeConv.otherUser.displayName || activeConv.otherUser.name || "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{activeConv.otherUser.displayName || activeConv.otherUser.name}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgsLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
                    </div>
                  ) : !messages?.items?.length ? (
                    <div className="text-center text-gray-400 text-sm py-8">No messages yet. Say hello!</div>
                  ) : (
                    messages.items.map((msg: any) => {
                      const isMe = msg.senderId === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isMe ? "bg-teal-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            <p className={`text-xs mt-1 ${isMe ? "text-teal-200" : "text-gray-400"}`}>{timeAgo(msg.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t flex gap-2">
                  <Input
                    value={messageBody}
                    onChange={e => setMessageBody(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (messageBody.trim() && activeConvId) {
                          sendMessage.mutate({ conversationId: activeConvId, body: messageBody.trim() });
                        }
                      }
                    }}
                  />
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={!messageBody.trim() || sendMessage.isPending}
                    onClick={() => {
                      if (messageBody.trim() && activeConvId) {
                        sendMessage.mutate({ conversationId: activeConvId, body: messageBody.trim() });
                      }
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
