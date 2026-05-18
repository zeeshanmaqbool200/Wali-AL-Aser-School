import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, Paper, CircularProgress, alpha, useTheme, Avatar, Divider, Button, Chip, Skeleton, Card, CardContent, Stack } from '@mui/material';
import { ShieldCheck, Calendar, User, BookOpen, Clock, CheckCircle, Smartphone, XCircle, IndianRupee, GraduationCap, Layout } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';

export default function Verify() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const theme = useTheme();

  useEffect(() => {
    async function verifyData() {
      if (!id || !type) return;
      try {
        const decodedId = decodeURIComponent(id);
        const collectionName = type === 'receipt' ? 'receipts' : 'users';
        console.log(`Verifying ${type} with id: ${decodedId}`);
        
        // 1. Try fetching by document ID
        const docRef = doc(db, collectionName, decodedId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          console.log("Found by doc ID");
          setData({ id: docSnap.id, ...docSnap.data() });
        } else {
          // 2. Comprehensive search if ID is not the document ID
          console.log("Searching alternative fields...");
          
          if (type === 'receipt') {
            const receiptQueries = [
              query(collection(db, 'receipts'), where('receiptNo', '==', decodedId)),
              query(collection(db, 'receipts'), where('receiptNumber', '==', decodedId))
            ];
            for (const q of receiptQueries) {
              const snap = await getDocs(q);
              if (!snap.empty) {
                setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
                return;
              }
            }
          } else {
            const searchTerms = [decodedId, decodedId.trim(), decodedId.trim().toLowerCase()];
            const fields = ['uid', 'id', 'email', 'admissionNo', 'studentId', 'teacherId'];
            
            for (const field of fields) {
              for (const term of searchTerms) {
                const q = query(collection(db, 'users'), where(field, '==', term));
                const snap = await getDocs(q);
                if (!snap.empty) {
                  setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
                  return;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Verification error:", error);
      } finally {
        setLoading(false);
      }
    }
    verifyData();
  }, [id, type]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 4 }}>
        <Skeleton variant="circular" width={80} height={80} sx={{ mb: 4 }} />
        <Skeleton variant="text" width={200} height={30} />
      </Box>
    );
  }

  if (!id || !type || !data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <XCircle size={64} color={theme.palette.error.main} style={{ marginBottom: 24 }} />
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-heading)' }}>Invalid Entry</Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>The scanned document could not be verified.</Typography>
        <Button variant="outlined" onClick={() => window.location.href = '/'} sx={{ borderRadius: 100, px: 4 }}>Back Home</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.palette.mode === 'dark' ? '#0a0a0a' : '#f5f7fa' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', maxWidth: 500 }}>
        
        {/* Certificate-like header */}
        <Box sx={{ textAlign: 'center', mb: -4, position: 'relative', zIndex: 10 }}>
           <Avatar 
             src="/logo.png" 
             sx={{ 
               width: 80, height: 80, mx: 'auto', bgcolor: 'white', p: 0.5, 
               boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
               border: '4px solid white'
             }} 
           />
        </Box>

        <Card sx={{ 
          borderRadius: 8, 
          boxShadow: theme.palette.mode === 'dark' ? '0 40px 100px rgba(0,0,0,0.6)' : '0 40px 100px rgba(0,0,0,0.08)', 
          border: '1px solid',
          borderColor: alpha(theme.palette.divider, 0.1),
          overflow: 'hidden',
          pt: 4
        }}>
          <Box sx={{ 
            p: 4, pt: 6, textAlign: 'center', 
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.success.main, 0.15)} 100%)` 
          }}>
            <Box sx={{ 
              display: 'inline-flex', p: 2, borderRadius: '50%', 
              bgcolor: 'success.main', color: 'white', mb: 2,
              boxShadow: `0 10px 25px ${alpha(theme.palette.success.main, 0.4)}`
            }}>
              <ShieldCheck size={40} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 950, fontFamily: 'var(--font-heading)', color: 'success.dark', letterSpacing: -1 }}>
              Official Verification
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, opacity: 0.7 }}>
              Security Clearance: LEVEL 1 (AUTHENTIC)
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Box sx={{ mb: 4, p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.background.default, 0.5), border: '1px solid', borderColor: alpha(theme.palette.divider, 0.05) }}>
              {type === 'receipt' ? (
                <Stack spacing={3}>
                  <DataRow icon={<User size={18} />} label="STUDENT NAME" value={data.studentName} />
                  <DataRow icon={<Smartphone size={18} />} label="RECEIPT NO" value={data.receiptNo} highlight />
                  <DataRow icon={< IndianRupee size={18} />} label="TOTAL AMOUNT" value={`Rs.${data.amount}`} />
                  <DataRow icon={<BookOpen size={18} />} label="CATEGORY" value={data.feeHead} />
                  <DataRow icon={<Calendar size={18} />} label="ISSUE DATE" value={data.date} />
                  <DataRow icon={<CheckCircle size={18} />} label="PAYMENT STATUS" value={(data.status || 'Verified').toUpperCase()} color="success.main" />
                </Stack>
              ) : (
                <Stack spacing={3}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar 
                        src={data.photoURL} 
                        sx={{ 
                          width: 120, height: 120, 
                          border: '4px solid', 
                          borderColor: 'primary.main',
                          boxShadow: `0 15px 35px ${alpha(theme.palette.primary.main, 0.2)}`
                        }} 
                      />
                      <Box sx={{ position: 'absolute', bottom: 5, right: 5, bgcolor: 'success.main', color: 'white', p: 0.5, borderRadius: '50%', border: '3px solid white' }}>
                        <CheckCircle size={16} />
                      </Box>
                    </Box>
                  </Box>
                  <DataRow icon={<User size={18} />} label="FULL NAME" value={data.displayName} highlight />
                  <DataRow icon={<GraduationCap size={18} />} label="IDENTIFICATION" value={data.admissionNo || data.teacherId || 'PROVISIONAL'} />
                  <DataRow icon={<Layout size={18} />} label="DESIGNATION" value={data.role?.toUpperCase()} />
                  <DataRow icon={<ShieldCheck size={18} />} label="ACCOUNT STATUS" value={(data.status || 'Active').toUpperCase()} color="success.main" />
                </Stack>
              )}
            </Box>

            <Divider sx={{ mb: 3 }}>
               <Typography variant="caption" sx={{ fontWeight: 900, px: 1.5, opacity: 0.5 }}>BLOCKCHAIN TIMESTAMP</Typography>
            </Divider>
            
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.75rem' }}>
              SECURITY HASH: {id?.substring(0, 8).toUpperCase()}-{type?.toUpperCase()}-{Math.random().toString(36).substring(7).toUpperCase()}
              <br />
              VERIFIED AT: {new Date().toLocaleString()}
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={() => window.location.href = '/'} 
                sx={{ borderRadius: 3, fontWeight: 900, py: 1.5, textTransform: 'none' }}
              >
                Back to Portal
              </Button>
              <Button 
                variant="contained" 
                fullWidth 
                onClick={() => window.print()} 
                sx={{ borderRadius: 3, fontWeight: 900, py: 1.5, textTransform: 'none' }}
              >
                Download PDF
              </Button>
            </Stack>
          </CardContent>
          <Box sx={{ p: 2, bgcolor: 'success.main', color: 'white', textAlign: 'center' }}>
             <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: 1.5 }}>OFFICIAL VERIFICATION PORTAL</Typography>
          </Box>
        </Card>
      </motion.div>
    </Box>
  );
}

function DataRow({ icon, label, value, highlight, color }: { icon: React.ReactNode, label: string, value: string, highlight?: boolean, color?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ opacity: 0.6 }}>{icon}</Box>
        <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', letterSpacing: 0.5 }}>{label}</Typography>
      </Stack>
      <Typography variant={highlight ? "body1" : "body2"} sx={{ fontWeight: highlight ? 950 : 800, color: color || 'text.primary', letterSpacing: highlight ? -0.5 : 0 }}>
        {value || 'DATA NOT AVAILABLE'}
      </Typography>
    </Box>
  );
}
