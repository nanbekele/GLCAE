import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, MessageSquare, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { callFunction } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: string;
  created_at: string;
}

const MarketingMessages = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchMessages();
  }, [token]);

  const fetchMessages = async () => {
    if (!token) return;

    try {
      const response = await callFunction<{ messages: ContactMessage[] }>('marketing-manage', {
        action: 'list-messages',
      }, { token, useAnonAuth: false });

      setMessages(response.messages || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load contact messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!token || !selectedMessage) return;
    if (!replyBody.trim()) {
      toast({
        title: 'Reply message required',
        description: 'Please enter a reply before sending.',
        variant: 'destructive',
      });
      return;
    }

    setSendingReply(true);
    try {
      await callFunction('marketing-manage', {
        action: 'reply-contact-message',
        messageId: selectedMessage.id,
        subject: replySubject.trim() || undefined,
        body: replyBody,
      }, { token, useAnonAuth: false });

      setMessages(prev => prev.map(msg =>
        msg.id === selectedMessage.id ? { ...msg, status: 'replied' } : msg
      ));

      setSelectedMessage(prev => prev ? { ...prev, status: 'replied' } : prev);
      setReplyBody('');
      setReplySubject('');

      toast({
        title: 'Reply sent',
        description: `Message sent to ${selectedMessage.email}.`,
      });
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Failed to send reply',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    if (selectedMessage) {
      setReplySubject(prev => prev || `Re: ${selectedMessage.subject || 'Your inquiry'}`);
    } else {
      setReplySubject('');
      setReplyBody('');
    }
  }, [selectedMessage]);

  const updateMessageStatus = async (messageId: string, status: string) => {
    if (!token) return;

    try {
      await callFunction('marketing-manage', {
        action: 'update-message-status',
        messageId,
        status,
      }, { token, useAnonAuth: false });
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      ));
      toast({
        title: 'Status updated',
        description: `Message marked as ${status}.`,
      });
    } catch (error) {
      console.error('Error updating message status:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to update message status',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'read': return 'bg-yellow-500';
      case 'replied': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Contact Messages</h1>
          <p className="text-muted-foreground">
            Manage and respond to customer inquiries and contact messages.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Messages List */}
          <div className="lg:col-span-2">
            <Card className="shadow-corporate border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail size={20} />
                  <span>Inbox ({messages.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No messages found</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedMessage?.id === message.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => setSelectedMessage(message)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={`${getStatusColor(message.status)} text-white border-0`}>
                              {message.status}
                            </Badge>
                            <h4 className="font-semibold text-foreground">{message.name}</h4>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{message.email}</p>
                        <p className="text-sm text-foreground font-medium line-clamp-1">
                          {message.subject || 'No Subject'}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {message.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Message Details */}
          <div>
            {selectedMessage ? (
              <Card className="shadow-corporate border-card-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye size={20} />
                    <span>Message Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">From</h4>
                    <p className="text-foreground">{selectedMessage.name}</p>
                    <p className="text-muted-foreground text-sm">{selectedMessage.email}</p>
                    {selectedMessage.phone && (
                      <p className="text-muted-foreground text-sm flex items-center mt-1">
                        <Phone size={14} className="mr-1" />
                        {selectedMessage.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Subject</h4>
                    <p className="text-foreground">{selectedMessage.subject || 'No Subject'}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Message</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selectedMessage.message}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Received</h4>
                    <p className="text-muted-foreground text-sm flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {new Date(selectedMessage.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Actions</h4>
                    <div className="space-y-2">
                      {selectedMessage.status === 'new' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                        >
                          Mark as Read
                        </Button>
                      )}
                      {selectedMessage.status !== 'replied' && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => updateMessageStatus(selectedMessage.id, 'replied')}
                        >
                          Mark as Replied
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => updateMessageStatus(selectedMessage.id, 'archived')}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-foreground">Reply</h4>
                    <Input
                      placeholder="Subject"
                      value={replySubject}
                      onChange={(event) => setReplySubject(event.target.value)}
                    />
                    <Textarea
                      placeholder="Write your reply..."
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      rows={6}
                    />
                    <Button
                      className="w-full"
                      onClick={sendReply}
                      disabled={sendingReply}
                    >
                      {sendingReply ? 'Sending...' : `Email ${selectedMessage.email}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-corporate border-card-border">
                <CardContent className="py-8 text-center">
                  <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a message to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingMessages;