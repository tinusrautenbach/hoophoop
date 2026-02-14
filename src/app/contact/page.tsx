import { Mail } from 'lucide-react';

export default function ContactPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
            <div className="bg-card/50 p-12 rounded-3xl border border-border backdrop-blur-sm max-w-lg w-full">
                <div className="bg-orange-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Mail className="w-10 h-10 text-orange-500" />
                </div>
                <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
                <p className="text-slate-400 mb-8 text-lg">
                    Have questions, suggestions, or just want to say hello? We'd love to hear from you.
                </p>
                <a
                    href="mailto:info@hoophoop.net"
                    className="text-2xl font-bold text-orange-500 hover:text-orange-400 transition-colors border-b-2 border-orange-500/50 hover:border-orange-500 pb-1"
                >
                    info@hoophoop.net
                </a>
            </div>
        </div>
    );
}
