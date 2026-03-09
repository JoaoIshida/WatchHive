"use client";
import { useUserData } from '../../contexts/UserDataContext';
import ProfileWishlistSection from '../ProfileWishlistSection';

export default function ProfileWishlistPage() {
    const { wishlistDetails, loadingWishlistDetails } = useUserData();

    return (
        <ProfileWishlistSection
            loadingWishlistDetails={loadingWishlistDetails}
            wishlistDetails={wishlistDetails}
        />
    );
}
