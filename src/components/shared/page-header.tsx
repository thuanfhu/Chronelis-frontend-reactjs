import { motion } from 'framer-motion'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
    </motion.div>
  )
}
