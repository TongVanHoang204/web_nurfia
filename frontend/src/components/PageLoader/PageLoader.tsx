import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './PageLoader.css';

interface PageLoaderProps {
  fullScreen?: boolean;
}

export default function PageLoader({ fullScreen = true }: PageLoaderProps) {
  return (
    <div className={`page-loader-container ${fullScreen ? 'full-screen' : ''}`}>
      <div className="lottie-wrapper">
        <DotLottieReact
          src="/assets/running-cat.lottie"
          loop
          autoplay
        />
      </div>
    </div>
  );
}
