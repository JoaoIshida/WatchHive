"use client";
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserData } from '../../contexts/UserDataContext';
import ProfileListsSection from '../ProfileListsSection';
import ListSettingsModal from '../../components/ListSettingsModal';

export default function ProfileListsPage() {
    const { user } = useAuth();
    const { customLists, listDetails, loadingListDetails, loadListDetails, refreshUserData } = useUserData();

    const [expandedListIds, setExpandedListIds] = useState([]);
    const [showCreateListForm, setShowCreateListForm] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListDescription, setNewListDescription] = useState('');
    const [newListIsPublic, setNewListIsPublic] = useState(false);
    const [createListError, setCreateListError] = useState(null);
    const [createListLoading, setCreateListLoading] = useState(false);
    const [listSettingsModalList, setListSettingsModalList] = useState(null);

    return (
        <>
            <ProfileListsSection
                customLists={customLists}
                listDetails={listDetails}
                loadingListDetails={loadingListDetails}
                user={user}
                expandedListIds={expandedListIds}
                setExpandedListIds={setExpandedListIds}
                loadListDetails={loadListDetails}
                showCreateListForm={showCreateListForm}
                setShowCreateListForm={setShowCreateListForm}
                newListName={newListName}
                setNewListName={setNewListName}
                newListDescription={newListDescription}
                setNewListDescription={setNewListDescription}
                newListIsPublic={newListIsPublic}
                setNewListIsPublic={setNewListIsPublic}
                createListError={createListError}
                setCreateListError={setCreateListError}
                createListLoading={createListLoading}
                setCreateListLoading={setCreateListLoading}
                setListSettingsModalList={setListSettingsModalList}
                refreshUserData={refreshUserData}
            />
            <ListSettingsModal
                list={listSettingsModalList}
                currentUserId={user?.id}
                onClose={() => setListSettingsModalList(null)}
                onSaved={() => { setListSettingsModalList(null); refreshUserData(); }}
            />
        </>
    );
}
