import { motion } from 'framer-motion';

export function TestAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0, backgroundColor: 'red', height: 50 }}
      animate={{ opacity: 1, backgroundColor: 'gold', height: 50 }}
      transition={{ duration: 2 }}
      style={{ width: '100%' }}
    />
  );
}
