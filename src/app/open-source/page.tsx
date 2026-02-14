import { Github } from 'lucide-react';
import Link from 'next/link';

export default function OpenSourcePage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
            <div className="bg-card/50 p-12 rounded-3xl border border-border backdrop-blur-sm max-w-lg w-full">
                <div className="bg-muted/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Github className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold mb-4">Open Source</h1>
                <p className="text-slate-400 mb-8 text-lg">
                    HoopHoop is proud to be open source. Check out our code, contribute, or run your own instance.
                </p>
                <Link
                    href="https://github.com/tinusrautenbach/hoophoop"
                    target="_blank"
                    className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-slate-200 transition-colors"
                >
                    <Github size={20} />
                    View on GitHub
                </Link>
            </div>
        </div>
    );
}
