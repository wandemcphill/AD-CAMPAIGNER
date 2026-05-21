"use client";

import { motion } from "framer-motion";
import type { ComponentPropsWithoutRef } from "react";

export function MotionSection(props: ComponentPropsWithoutRef<typeof motion.div>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      {...props}
    />
  );
}
